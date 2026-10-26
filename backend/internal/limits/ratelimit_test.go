package limits

import (
	"fmt"
	"testing"
	"time"
)

type clock struct{ t time.Time }

func (c *clock) now() time.Time      { return c.t }
func (c *clock) add(d time.Duration) { c.t = c.t.Add(d) }
func newClock() *clock               { return &clock{t: time.Unix(1_800_000_000, 0)} }

func TestLimiterBurstThenRefill(t *testing.T) {
	c := newClock()
	l := New(60, 3, c.now) // one token per second, burst 3
	for i := range 3 {
		if !l.Allow("a") {
			t.Fatalf("request %d within burst denied", i+1)
		}
	}
	if l.Allow("a") {
		t.Fatal("request over burst allowed")
	}
	if l.Allow("b") != true {
		t.Fatal("other key must have its own bucket")
	}
	c.add(time.Second)
	if !l.Allow("a") {
		t.Fatal("token not refilled after one second")
	}
}

func TestLimiterRetryAfter(t *testing.T) {
	c := newClock()
	l := New(30, 1, c.now) // one token per two seconds
	l.Allow("a")
	if got := l.RetryAfter("a"); got != 2*time.Second {
		t.Errorf("RetryAfter = %v, want 2s", got)
	}
	if got := l.RetryAfter("unknown"); got != 0 {
		t.Errorf("RetryAfter for new key = %v, want 0", got)
	}
}

func TestLimiterForgetsIdleKeys(t *testing.T) {
	c := newClock()
	l := New(60, 1, c.now)
	for i := range maxKeys {
		l.Allow(fmt.Sprintf("k%d", i))
	}
	c.add(idleAfter + time.Second)
	l.Allow("fresh")
	if n := l.size(); n != 1 {
		t.Errorf("after idle sweep size = %d, want 1", n)
	}
}

func TestLimiterAllowN(t *testing.T) {
	c := newClock()
	l := New(60, 10, c.now)
	if !l.AllowN("a", 8) {
		t.Fatal("8 of 10 tokens denied")
	}
	if l.AllowN("a", 3) {
		t.Fatal("3 more tokens allowed with 2 left")
	}
	if !l.AllowN("a", 2) {
		t.Fatal("2 remaining tokens denied: a denied AllowN must not spend tokens")
	}
}

func TestLimiterRejectsNewKeysWhenFullOfActiveKeys(t *testing.T) {
	c := newClock()
	l := New(60, 1, c.now)
	for i := range maxKeys {
		l.Allow(fmt.Sprintf("k%d", i))
	}
	if l.Allow("new") {
		t.Error("new key allowed while the table is full of active keys")
	}
	if n := l.size(); n > maxKeys {
		t.Errorf("size = %d, want at most %d", n, maxKeys)
	}
}
