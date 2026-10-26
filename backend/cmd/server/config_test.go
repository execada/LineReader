package main

import (
	"strings"
	"testing"
)

func env(vars map[string]string) func(string) string {
	return func(k string) string { return vars[k] }
}

func TestLoadConfigDefaults(t *testing.T) {
	c, err := loadConfig(env(map[string]string{"SVERKA_TOKEN": strings.Repeat("x", 32)}))
	if err != nil {
		t.Fatalf("loadConfig: %v", err)
	}
	if c.addr != ":8080" || c.tessdata != "/usr/share/tessdata" || c.workers < 1 || c.workers > 4 || c.inFlight != 2*c.workers ||
		c.perMinute != 60 || c.burst != 40 || c.trustProxy {
		t.Errorf("defaults = %+v", c)
	}
}

func TestLoadConfigOverrides(t *testing.T) {
	c, err := loadConfig(env(map[string]string{
		"SVERKA_TOKEN": strings.Repeat("y", 20), "SVERKA_ADDR": ":9000", "TESSDATA_PREFIX": "/td",
		"SVERKA_WORKERS": "3", "SVERKA_RATE_PER_MINUTE": "120", "SVERKA_RATE_BURST": "25", "SVERKA_TRUST_PROXY": "1",
	}))
	if err != nil {
		t.Fatalf("loadConfig: %v", err)
	}
	if c.addr != ":9000" || c.tessdata != "/td" || c.workers != 3 || c.perMinute != 120 || c.burst != 25 || !c.trustProxy {
		t.Errorf("config = %+v", c)
	}
}

func TestLoadConfigErrors(t *testing.T) {
	_, err := loadConfig(env(map[string]string{"SVERKA_TOKEN": "short", "SVERKA_WORKERS": "0", "SVERKA_RATE_BURST": "x"}))
	if err == nil {
		t.Fatal("want error")
	}
	for _, want := range []string{"SVERKA_TOKEN", "SVERKA_WORKERS", "SVERKA_RATE_BURST"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %s", err, want)
		}
	}
	if strings.Contains(err.Error(), "short") {
		t.Error("error must not echo the token")
	}
}

func TestLoadConfigBurstFitsOneRequest(t *testing.T) {
	_, err := loadConfig(env(map[string]string{"SVERKA_TOKEN": strings.Repeat("z", 20), "SVERKA_RATE_BURST": "10"}))
	if err == nil || !strings.Contains(err.Error(), "SVERKA_RATE_BURST") {
		t.Errorf("burst 10 < 20 regions: err = %v", err)
	}
}
