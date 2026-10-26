package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"image/png"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"sverka/backend/internal/limits"
	"sverka/backend/internal/ocr"
)

const testToken = "test-token-0123456789"

type fakeRecognizer struct {
	mu    sync.Mutex
	calls int
	fail  bool
	seen  [][]string
	block chan struct{}
}

func (f *fakeRecognizer) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls
}

func (f *fakeRecognizer) Recognize(ctx context.Context, img image.Image, langs []string) (ocr.Result, error) {
	if f.block != nil {
		select {
		case <-f.block:
		case <-ctx.Done():
			return ocr.Result{}, ctx.Err()
		}
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	f.seen = append(f.seen, langs)
	if f.fail {
		return ocr.Result{}, errors.New("tesseract exploded with secret text ИНН 6600123450")
	}
	return ocr.Result{
		Text:       "ИНН 6600123450",
		Confidence: 0.9,
		Words:      []ocr.Word{{Text: "ИНН", Confidence: 0.95, BBox: [4]int{0, 0, 30, 10}}},
	}, nil
}

func (f *fakeRecognizer) Engine() string { return "tesseract-test" }

type env struct {
	handler http.Handler
	rec     *fakeRecognizer
	logs    *bytes.Buffer
}

func newEnv(t *testing.T, perMinute float64, burst int) env {
	t.Helper()
	return newEnvWith(t, &fakeRecognizer{}, func(c *Config) {
		c.Limiter = limits.New(perMinute, burst, time.Now)
	})
}

func newEnvWith(t *testing.T, rec *fakeRecognizer, adjust func(*Config)) env {
	t.Helper()
	logs := &bytes.Buffer{}
	cfg := Config{
		Token:          testToken,
		Languages:      []string{"deu", "eng", "rus"},
		Limiter:        limits.New(600, 100, time.Now),
		Logger:         slog.New(slog.NewJSONHandler(logs, nil)),
		MaxInFlight:    4,
		RequestTimeout: 5 * time.Second,
	}
	adjust(&cfg)
	h, err := NewHandler(rec, cfg)
	if err != nil {
		t.Fatalf("NewHandler: %v", err)
	}
	return env{handler: h, rec: rec, logs: logs}
}

func pngOf(t *testing.T, w, h int) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, image.NewGray(image.Rect(0, 0, w, h))); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

type part struct {
	name string
	data []byte
}

func multipartBody(t *testing.T, parts ...part) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	for _, p := range parts {
		fw, err := w.CreateFormFile(p.name, p.name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := fw.Write(p.data); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return body, w.FormDataContentType()
}

func metaPart(t *testing.T, langs []string, ids ...string) part {
	t.Helper()
	regions := make([]map[string]string, len(ids))
	for i, id := range ids {
		regions[i] = map[string]string{"id": id}
	}
	data, err := json.Marshal(map[string]any{"languages": langs, "regions": regions})
	if err != nil {
		t.Fatal(err)
	}
	return part{"meta", data}
}

func do(t *testing.T, h http.Handler, method, path string, body io.Reader, contentType, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, body)
	req.RemoteAddr = "203.0.113.7:5555"
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if req.MultipartForm != nil {
		t.Fatal("handler parsed the body with ParseMultipartForm, which can spill parts to disk")
	}
	return rr
}

type respEnvelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func decode(t *testing.T, rr *httptest.ResponseRecorder) respEnvelope {
	t.Helper()
	var e respEnvelope
	if err := json.Unmarshal(rr.Body.Bytes(), &e); err != nil {
		t.Fatalf("response is not an envelope: %v\n%s", err, rr.Body.String())
	}
	return e
}
