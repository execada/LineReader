package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthcheck(t *testing.T) {
	ok := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	defer ok.Close()
	if code := healthcheck(strings.TrimPrefix(ok.URL, "http://")); code != 0 {
		t.Errorf("healthy server: exit %d", code)
	}
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer bad.Close()
	if code := healthcheck(strings.TrimPrefix(bad.URL, "http://")); code != 1 {
		t.Errorf("unhealthy server: exit %d", code)
	}
	if code := healthcheck(":1"); code != 1 {
		t.Errorf("nothing listening: exit %d", code)
	}
}
