package api

import (
	"log/slog"
	"net/http/httptest"
	"time"

	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sverka/backend/internal/limits"
	"testing"
)

const recognizePath = "/v1/regions:recognize"

func TestRecognizeSuccess(t *testing.T) {
	e := newEnv(t, 600, 100)
	body, ct := multipartBody(t,
		metaPart(t, []string{"rus", "eng"}, "r1", "r2"),
		part{"r1", pngOf(t, 300, 40)},
		part{"r2", pngOf(t, 300, 40)},
	)
	rr := do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	env := decode(t, rr)
	if !env.Success || env.Error != nil {
		t.Fatalf("envelope = %+v", env)
	}
	var data struct {
		Engine  string `json:"engine"`
		Regions []struct {
			ID         string  `json:"id"`
			Text       string  `json:"text"`
			Confidence float64 `json:"confidence"`
			Words      []struct {
				Text string `json:"text"`
				BBox [4]int `json:"bbox"`
			} `json:"words"`
		} `json:"regions"`
	}
	if err := json.Unmarshal(env.Data, &data); err != nil {
		t.Fatal(err)
	}
	if data.Engine != "tesseract-test" || len(data.Regions) != 2 || data.Regions[1].ID != "r2" {
		t.Fatalf("data = %+v", data)
	}
	if data.Regions[0].Text != "ИНН 6600123450" || data.Regions[0].Words[0].BBox != [4]int{0, 0, 30, 10} {
		t.Errorf("region = %+v", data.Regions[0])
	}
	if e.rec.callCount() != 2 || strings.Join(e.rec.seen[0], "+") != "rus+eng" {
		t.Errorf("recognizer calls=%d langs=%v", e.rec.calls, e.rec.seen)
	}
}

func TestRecognizeValidation(t *testing.T) {
	img := pngOf(t, 300, 40)
	tooWide := pngOf(t, 4001, 40)
	tooTall := pngOf(t, 300, 1001)
	manyIDs := make([]string, 21)
	manyParts := []part{}
	for i := range manyIDs {
		manyIDs[i] = "r" + string(rune('a'+i))
		manyParts = append(manyParts, part{manyIDs[i], img})
	}

	tests := []struct {
		name  string
		parts []part
	}{
		{"no meta", []part{{"r1", img}}},
		{"meta not json", []part{{"meta", []byte("{")}, {"r1", img}}},
		{"no regions", []part{metaPart(t, []string{"rus"})}},
		{"no languages", []part{metaPart(t, nil, "r1"), {"r1", img}}},
		{"unknown language", []part{metaPart(t, []string{"xxx"}, "r1"), {"r1", img}}},
		{"language path trick", []part{metaPart(t, []string{"../rus"}, "r1"), {"r1", img}}},
		{"too many languages", []part{metaPart(t, []string{"rus", "eng", "deu", "bel", "kaz", "pol"}, "r1"), {"r1", img}}},
		{"duplicate language", []part{metaPart(t, []string{"rus", "rus"}, "r1"), {"r1", img}}},
		{"png header with corrupt body", []part{metaPart(t, []string{"rus"}, "r1"), {"r1", img[:60]}}},
		{"region without image", []part{metaPart(t, []string{"rus"}, "r1", "r2"), {"r1", img}}},
		{"image without region", []part{metaPart(t, []string{"rus"}, "r1"), {"r1", img}, {"r2", img}}},
		{"duplicate id", []part{metaPart(t, []string{"rus"}, "r1", "r1"), {"r1", img}}},
		{"bad id", []part{metaPart(t, []string{"rus"}, "r 1"), {"r 1", img}}},
		{"meta as region id", []part{metaPart(t, []string{"rus"}, "meta"), {"meta", img}}},
		{"not an image", []part{metaPart(t, []string{"rus"}, "r1"), {"r1", []byte("GIF89a not really")}}},
		{"too wide", []part{metaPart(t, []string{"rus"}, "r1"), {"r1", tooWide}}},
		{"too tall", []part{metaPart(t, []string{"rus"}, "r1"), {"r1", tooTall}}},
		{"too many regions", append([]part{metaPart(t, []string{"rus"}, manyIDs...)}, manyParts...)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := newEnv(t, 600, 100)
			body, ct := multipartBody(t, tt.parts...)
			rr := do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body %s", rr.Code, rr.Body.String())
			}
			env := decode(t, rr)
			if env.Success || env.Error == nil || env.Error.Code != "invalid_request" || env.Error.Message == "" {
				t.Errorf("envelope = %s", rr.Body.String())
			}
			if e.rec.callCount() != 0 {
				t.Errorf("recognizer called %d times on invalid request", e.rec.calls)
			}
		})
	}
}

func TestRecognizeNotMultipart(t *testing.T) {
	e := newEnv(t, 600, 100)
	rr := do(t, e.handler, http.MethodPost, recognizePath, strings.NewReader("{}"), "application/json", testToken)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rr.Code)
	}
}

func TestRecognizeTooLarge(t *testing.T) {
	big := bytes.Repeat([]byte{0}, maxRegionBytes+1)
	tests := []struct {
		name  string
		parts []part
	}{
		{"region over 1 MB", []part{metaPart(t, []string{"rus"}, "r1"), {"r1", big}}},
		{"body over 10 MB", func() []part {
			ps := []part{metaPart(t, []string{"rus"}, "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k")}
			for _, id := range []string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"} {
				ps = append(ps, part{id, big[:maxRegionBytes]})
			}
			return ps
		}()},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := newEnv(t, 600, 100)
			body, ct := multipartBody(t, tt.parts...)
			rr := do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
			if rr.Code != http.StatusRequestEntityTooLarge {
				t.Fatalf("status = %d, want 413; body %s", rr.Code, rr.Body.String())
			}
			if env := decode(t, rr); env.Error == nil || env.Error.Code != "too_large" {
				t.Errorf("envelope = %s", rr.Body.String())
			}
		})
	}
}

func TestRecognizeEngineFailureHidesDetails(t *testing.T) {
	e := newEnv(t, 600, 100)
	e.rec.fail = true
	body, ct := multipartBody(t, metaPart(t, []string{"rus"}, "r1"), part{"r1", pngOf(t, 300, 40)})
	rr := do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rr.Code)
	}
	for _, leak := range []string{"ИНН", "6600123450", "exploded"} {
		if strings.Contains(rr.Body.String(), leak) || strings.Contains(e.logs.String(), leak) {
			t.Errorf("%q leaked: body %s logs %s", leak, rr.Body.String(), e.logs.String())
		}
	}
}

func TestRecognizeWritesNothingToDisk(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("TMPDIR", tmp)
	if os.TempDir() != tmp {
		t.Skip("os.TempDir does not follow TMPDIR on this platform")
	}
	e := newEnv(t, 600, 100)
	ids := []string{"a", "b", "c", "d", "e", "f", "g", "h", "i"}
	parts := []part{metaPart(t, []string{"rus"}, ids...)}
	for _, id := range ids {
		// Large parts would spill to temp files with http.Request.ParseMultipartForm.
		parts = append(parts, part{id, append(pngOf(t, 4000, 1000), bytes.Repeat([]byte{0}, 900_000)...)})
	}
	body, ct := multipartBody(t, parts...)
	rr := do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	entries, err := os.ReadDir(tmp)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Errorf("temp dir not empty after request: %v", entries)
	}
}

func TestRecognizeWrongMethod(t *testing.T) {
	e := newEnv(t, 600, 100)
	rr := do(t, e.handler, http.MethodGet, recognizePath, nil, "", testToken)
	if rr.Code != http.StatusMethodNotAllowed || rr.Header().Get("Allow") != "POST" {
		t.Errorf("status = %d Allow = %q, want 405 with Allow: POST", rr.Code, rr.Header().Get("Allow"))
	}
}

func TestRecognizeChargesRateLimitPerRegion(t *testing.T) {
	e := newEnv(t, 60, 5)
	ids := []string{"a", "b", "c", "d"}
	parts := []part{metaPart(t, []string{"rus"}, ids...)}
	for _, id := range ids {
		parts = append(parts, part{id, pngOf(t, 100, 20)})
	}
	body, ct := multipartBody(t, parts...)
	if rr := do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken); rr.Code != http.StatusOK {
		t.Fatalf("first request: %d %s", rr.Code, rr.Body.String())
	}
	body, ct = multipartBody(t, parts...)
	rr := do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("4 regions twice with a budget of 5: status %d, want 429", rr.Code)
	}
}

func TestRecognizeBusyWhenTooManyInFlight(t *testing.T) {
	rec := &fakeRecognizer{block: make(chan struct{})}
	e := newEnvWith(t, rec, func(c *Config) { c.MaxInFlight = 1 })
	started := make(chan struct{})
	go func() {
		body, ct := multipartBody(t, metaPart(t, []string{"rus"}, "r1"), part{"r1", pngOf(t, 100, 20)})
		close(started)
		do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
	}()
	<-started
	deadline := time.Now().Add(2 * time.Second)
	var rr *httptest.ResponseRecorder
	for time.Now().Before(deadline) {
		body, ct := multipartBody(t, metaPart(t, []string{"rus"}, "r1"), part{"r1", pngOf(t, 100, 20)})
		rr = do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
		if rr.Code == http.StatusServiceUnavailable {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	close(rec.block)
	if rr.Code != http.StatusServiceUnavailable || rr.Header().Get("Retry-After") == "" {
		t.Fatalf("status = %d, want 503 with Retry-After", rr.Code)
	}
	if env := decode(t, rr); env.Error == nil || env.Error.Code != "busy" {
		t.Errorf("body = %s", rr.Body.String())
	}
}

func TestRecognizeTimeout(t *testing.T) {
	rec := &fakeRecognizer{block: make(chan struct{})}
	defer close(rec.block)
	e := newEnvWith(t, rec, func(c *Config) { c.RequestTimeout = 50 * time.Millisecond })
	body, ct := multipartBody(t, metaPart(t, []string{"rus"}, "r1"), part{"r1", pngOf(t, 100, 20)})
	rr := do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rr.Code)
	}
	if env := decode(t, rr); env.Error == nil || env.Error.Code != "timeout" {
		t.Errorf("body = %s", rr.Body.String())
	}
}

func TestNewHandlerRejectsBadConfig(t *testing.T) {
	base := Config{Token: testToken, Languages: []string{"rus"}, Limiter: limits.New(1, 1, time.Now),
		Logger: slog.Default(), MaxInFlight: 1, RequestTimeout: time.Second}
	tests := []struct {
		name   string
		adjust func(*Config)
	}{
		{"empty token", func(c *Config) { c.Token = "" }},
		{"no languages", func(c *Config) { c.Languages = nil }},
		{"no limiter", func(c *Config) { c.Limiter = nil }},
		{"no logger", func(c *Config) { c.Logger = nil }},
		{"zero in-flight", func(c *Config) { c.MaxInFlight = 0 }},
		{"zero timeout", func(c *Config) { c.RequestTimeout = 0 }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := base
			tt.adjust(&cfg)
			if _, err := NewHandler(&fakeRecognizer{}, cfg); err == nil {
				t.Error("want error")
			}
		})
	}
}
