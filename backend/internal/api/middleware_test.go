package api

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

func TestAuth(t *testing.T) {
	tests := []struct {
		name   string
		header string
	}{
		{"missing", ""},
		{"wrong token", "Bearer nope"},
		{"wrong scheme", "Basic " + testToken},
		{"token prefix", "Bearer " + testToken[:5]},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := newEnv(t, 600, 100)
			req := httptest.NewRequest(http.MethodGet, "/v1/languages", nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			rr := httptest.NewRecorder()
			e.handler.ServeHTTP(rr, req)
			if rr.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", rr.Code)
			}
			if env := decode(t, rr); env.Error == nil || env.Error.Code != "unauthorized" {
				t.Errorf("body = %s", rr.Body.String())
			}
		})
	}
}

func TestLanguages(t *testing.T) {
	e := newEnv(t, 600, 100)
	rr := do(t, e.handler, http.MethodGet, "/v1/languages", nil, "", testToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	var data struct {
		Engine    string   `json:"engine"`
		Languages []string `json:"languages"`
	}
	if err := json.Unmarshal(decode(t, rr).Data, &data); err != nil {
		t.Fatal(err)
	}
	if data.Engine != "tesseract-test" || !slices.Equal(data.Languages, []string{"deu", "eng", "rus"}) {
		t.Errorf("data = %+v", data)
	}
}

func TestHealthzNeedsNoToken(t *testing.T) {
	e := newEnv(t, 600, 100)
	rr := do(t, e.handler, http.MethodGet, "/healthz", nil, "", "")
	if rr.Code != http.StatusOK || !decode(t, rr).Success {
		t.Errorf("status = %d body %s", rr.Code, rr.Body.String())
	}
}

func TestUnknownPath(t *testing.T) {
	e := newEnv(t, 600, 100)
	rr := do(t, e.handler, http.MethodGet, "/v1/nothing", nil, "", testToken)
	if rr.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rr.Code)
	}
}

func TestRateLimit(t *testing.T) {
	e := newEnv(t, 60, 2)
	for i := range 2 {
		if rr := do(t, e.handler, http.MethodGet, "/v1/languages", nil, "", testToken); rr.Code != http.StatusOK {
			t.Fatalf("request %d: status %d", i+1, rr.Code)
		}
	}
	rr := do(t, e.handler, http.MethodGet, "/v1/languages", nil, "", testToken)
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", rr.Code)
	}
	if rr.Header().Get("Retry-After") == "" {
		t.Error("429 without Retry-After")
	}
	if env := decode(t, rr); env.Error == nil || env.Error.Code != "rate_limited" {
		t.Errorf("body = %s", rr.Body.String())
	}
}

func TestRateLimitAppliesBeforeAuth(t *testing.T) {
	e := newEnv(t, 60, 1)
	do(t, e.handler, http.MethodGet, "/v1/languages", nil, "", "wrong")
	if rr := do(t, e.handler, http.MethodGet, "/v1/languages", nil, "", testToken); rr.Code != http.StatusTooManyRequests {
		t.Errorf("token guessing must spend the same bucket: status %d", rr.Code)
	}
}

func TestClientKey(t *testing.T) {
	tests := []struct {
		name       string
		trustProxy bool
		remote     string
		xff        string
		want       string
	}{
		{"remote addr", false, "198.51.100.1:1234", "10.0.0.1", "198.51.100.1"},
		{"proxy: rightmost hop", true, "172.17.0.2:1234", "10.0.0.1, 198.51.100.9", "198.51.100.9"},
		{"proxy without header", true, "172.17.0.2:1234", "", "172.17.0.2"},
		{"remote without port", false, "198.51.100.1", "", "198.51.100.1"},
		{"ipv6 grouped by /64", false, "[2001:db8:1:2:aaaa::1]:443", "", "2001:db8:1:2::/64"},
		{"proxy: invalid hop falls back", true, "172.17.0.2:1234", "10.0.0.1, not-an-ip", "172.17.0.2"},
		{"proxy: trailing comma falls back", true, "172.17.0.2:1234", "10.0.0.1,", "172.17.0.2"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = tt.remote
			if tt.xff != "" {
				req.Header.Set("X-Forwarded-For", tt.xff)
			}
			if got := clientKey(req, tt.trustProxy); got != tt.want {
				t.Errorf("clientKey = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestLogsOnlyMethodStatusDurationRegions(t *testing.T) {
	e := newEnv(t, 600, 100)
	body, ct := multipartBody(t, metaPart(t, []string{"rus"}, "r1", "r2"),
		part{"r1", pngOf(t, 300, 40)}, part{"r2", pngOf(t, 300, 40)})
	do(t, e.handler, http.MethodPost, recognizePath, body, ct, testToken)
	do(t, e.handler, http.MethodGet, "/v1/languages", nil, "", "wrong")

	lines := strings.Split(strings.TrimSpace(e.logs.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("want 2 log lines, got %d:\n%s", len(lines), e.logs.String())
	}
	allowed := []string{"time", "level", "msg", "method", "status", "duration_ms", "regions"}
	for _, line := range lines {
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatal(err)
		}
		for k := range rec {
			if !slices.Contains(allowed, k) {
				t.Errorf("unexpected log key %q in %s", k, line)
			}
		}
	}
	var first map[string]any
	_ = json.Unmarshal([]byte(lines[0]), &first)
	if first["regions"] != float64(2) || first["status"] != float64(200) || first["method"] != "POST" {
		t.Errorf("first log line = %v", first)
	}
	for _, leak := range []string{"ИНН", "rus", "r1", testToken, "203.0.113.7", "/v1"} {
		if strings.Contains(e.logs.String(), leak) {
			t.Errorf("logs contain %q:\n%s", leak, e.logs.String())
		}
	}
}

func TestPanicBecomes500WithoutDetails(t *testing.T) {
	logs := &bytes.Buffer{}
	h := recoverer(slog.New(slog.NewJSONHandler(logs, nil)), http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("secret ИНН 6600123450")
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != http.StatusInternalServerError || strings.Contains(rr.Body.String(), "ИНН") {
		t.Errorf("status %d body %s", rr.Code, rr.Body.String())
	}
	if strings.Contains(logs.String(), "ИНН") || !strings.Contains(logs.String(), "panic") {
		t.Errorf("logs = %s", logs.String())
	}
}
