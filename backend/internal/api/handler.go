// Package api serves the region recognition HTTP API described in docs/api.md.
package api

import (
	"context"
	"errors"
	"image"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"sverka/backend/internal/limits"
	"sverka/backend/internal/ocr"
)

// Recognizer reads one region image as a line of text.
type Recognizer interface {
	Recognize(ctx context.Context, img image.Image, langs []string) (ocr.Result, error)
	Engine() string
}

type Config struct {
	Token     string
	Languages []string
	Limiter   *limits.Limiter
	Logger    *slog.Logger
	// MaxInFlight caps concurrent /v1 requests; each may hold a 10 MB body.
	MaxInFlight int
	// RequestTimeout bounds waiting for and running recognition of one request.
	RequestTimeout time.Duration
	TrustProxy     bool
}

func (c Config) validate() error {
	var errs []error
	if c.Token == "" {
		errs = append(errs, errors.New("token is empty"))
	}
	if len(c.Languages) == 0 {
		errs = append(errs, errors.New("no languages"))
	}
	if c.Limiter == nil || c.Logger == nil {
		errs = append(errs, errors.New("limiter and logger are required"))
	}
	if c.MaxInFlight < 1 || c.RequestTimeout <= 0 {
		errs = append(errs, errors.New("MaxInFlight and RequestTimeout must be positive"))
	}
	return errors.Join(errs...)
}

type server struct {
	rec       Recognizer
	languages []string
	allowed   map[string]bool
	limiter   *limits.Limiter
	timeout   time.Duration
}

// NewHandler wires routes and middleware: request log, panic recovery,
// then rate limit, token check and in-flight cap for /v1/.
func NewHandler(rec Recognizer, cfg Config) (http.Handler, error) {
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	s := &server{
		rec:       rec,
		languages: slices.Clone(cfg.Languages),
		allowed:   map[string]bool{},
		limiter:   cfg.Limiter,
		timeout:   cfg.RequestTimeout,
	}
	for _, l := range cfg.Languages {
		s.allowed[l] = true
	}

	v1 := http.NewServeMux()
	v1.HandleFunc("POST /v1/regions:recognize", s.recognize)
	v1.HandleFunc("GET /v1/languages", s.listLanguages)
	v1.HandleFunc("/v1/", s.notFound)

	root := http.NewServeMux()
	root.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeData(w, map[string]string{"status": "ok"})
	})
	root.Handle("/v1/", rateLimit(cfg.Limiter, cfg.TrustProxy,
		requireToken(cfg.Token, inFlight(cfg.MaxInFlight, methodGuard(v1)))))
	root.HandleFunc("/", s.notFound)

	return requestLog(cfg.Logger, recoverer(cfg.Logger, root)), nil
}

func (s *server) listLanguages(w http.ResponseWriter, _ *http.Request) {
	writeData(w, map[string]any{"engine": s.rec.Engine(), "languages": s.languages})
}

func (s *server) notFound(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotFound, codeNotFound, "no such endpoint")
}
