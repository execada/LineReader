// Command server runs the Sverka region recognition API.
package main

import (
	"context"
	"errors"
	"io"
	stdlog "log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"sverka/backend/internal/api"
	"sverka/backend/internal/limits"
	"sverka/backend/internal/ocr"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "-healthcheck" {
		os.Exit(healthcheck(or(os.Getenv("SVERKA_ADDR"), ":8080")))
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("server stopped", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

// healthcheck is the container probe: the slim image has no curl.
func healthcheck(addr string) int {
	if strings.HasPrefix(addr, ":") {
		addr = "127.0.0.1" + addr
	}
	c := &http.Client{Timeout: 2 * time.Second}
	res, err := c.Get("http://" + addr + "/healthz")
	if err != nil {
		return 1
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func run(log *slog.Logger) error {
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		return err
	}
	pool, err := ocr.NewPool(cfg.tessdata, cfg.workers)
	if err != nil {
		return err
	}
	defer pool.Close()
	langs, err := ocr.InstalledLanguages(cfg.tessdata)
	if err != nil {
		return err
	}

	handler, err := api.NewHandler(pool, api.Config{
		Token:          cfg.token,
		Languages:      langs,
		Limiter:        limits.New(cfg.perMinute, cfg.burst, time.Now),
		Logger:         log,
		MaxInFlight:    cfg.inFlight,
		RequestTimeout: 60 * time.Second,
		TrustProxy:     cfg.trustProxy,
	})
	if err != nil {
		return err
	}
	srv := &http.Server{
		Addr:              cfg.addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      90 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
		// net/http's own messages include client addresses; the log policy allows none.
		ErrorLog: stdlog.New(io.Discard, "", 0),
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Info("listening", slog.String("addr", cfg.addr), slog.Int("languages", len(langs)), slog.Int("workers", cfg.workers))

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
		stop()
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdown); err != nil && !errors.Is(err, http.ErrServerClosed) {
		_ = srv.Close()
		return err
	}
	return nil
}
