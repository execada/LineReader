package main

import (
	"errors"
	"fmt"
	"runtime"
	"strconv"
)

const (
	minTokenLen          = 20
	maxRegionsPerRequest = 20
)

type config struct {
	addr       string
	token      string
	tessdata   string
	workers    int
	inFlight   int
	perMinute  float64
	burst      int
	trustProxy bool
}

// loadConfig reads SVERKA_* variables; getenv is os.Getenv outside tests.
func loadConfig(getenv func(string) string) (config, error) {
	c := config{
		addr:     or(getenv("SVERKA_ADDR"), ":8080"),
		token:    getenv("SVERKA_TOKEN"),
		tessdata: or(getenv("TESSDATA_PREFIX"), "/usr/share/tessdata"),
	}
	var errs []error
	if len(c.token) < minTokenLen {
		errs = append(errs, fmt.Errorf("SVERKA_TOKEN must be set, at least %d characters", minTokenLen))
	}
	// Each Tesseract client can take 100-200 MB on a 4000×1000 region.
	c.workers = intVar(getenv, "SVERKA_WORKERS", min(runtime.NumCPU(), 4), &errs)
	c.inFlight = intVar(getenv, "SVERKA_MAX_IN_FLIGHT", 2*c.workers, &errs)
	// Each region costs one token, so the burst must fit one full 20-region request.
	c.burst = intVar(getenv, "SVERKA_RATE_BURST", 40, &errs)
	if c.burst < maxRegionsPerRequest {
		errs = append(errs, fmt.Errorf("SVERKA_RATE_BURST must be at least %d (one full request)", maxRegionsPerRequest))
	}
	c.perMinute = float64(intVar(getenv, "SVERKA_RATE_PER_MINUTE", 60, &errs))
	c.trustProxy = getenv("SVERKA_TRUST_PROXY") == "1"
	return c, errors.Join(errs...)
}

func intVar(getenv func(string) string, name string, def int, errs *[]error) int {
	raw := getenv(name)
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 1 {
		*errs = append(*errs, fmt.Errorf("%s must be a positive integer, got %q", name, raw))
		return def
	}
	return v
}

func or(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
