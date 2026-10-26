// Package limits implements an in-memory token bucket per client key.
package limits

import (
	"math"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const (
	// maxKeys triggers a sweep of idle buckets, bounding memory under many clients.
	maxKeys    = 10_000
	idleAfter  = 10 * time.Minute
	sweepEvery = time.Minute
)

type bucket struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// Limiter allows perMinute requests per key with bursts of up to burst.
type Limiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	every   rate.Limit
	burst   int
	now     func() time.Time
	swept   time.Time
}

// New creates a limiter; now is injectable for tests (pass time.Now in production).
func New(perMinute float64, burst int, now func() time.Time) *Limiter {
	return &Limiter{
		buckets: map[string]*bucket{},
		every:   rate.Limit(perMinute / 60),
		burst:   burst,
		now:     now,
	}
}

// Allow takes one token for key, reporting whether the request may proceed.
func (l *Limiter) Allow(key string) bool { return l.AllowN(key, 1) }

// AllowN takes n tokens for key at once, or none if fewer are available.
// A new key is refused while the table is full of recently active keys.
func (l *Limiter) AllowN(key string, n int) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	b, ok := l.buckets[key]
	if !ok {
		if len(l.buckets) >= maxKeys && now.Sub(l.swept) >= sweepEvery {
			l.sweep(now)
		}
		if len(l.buckets) >= maxKeys {
			return false
		}
		b = &bucket{limiter: rate.NewLimiter(l.every, l.burst)}
		l.buckets[key] = b
	}
	b.lastSeen = now
	return b.limiter.AllowN(now, n)
}

// RetryAfter is how long key must wait for the next token, rounded up to a second.
func (l *Limiter) RetryAfter(key string) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()
	b, ok := l.buckets[key]
	if !ok {
		return 0
	}
	missing := 1 - b.limiter.TokensAt(l.now())
	if missing <= 0 {
		return 0
	}
	return time.Duration(math.Ceil(missing/float64(l.every))) * time.Second
}

// sweep drops idle buckets; it runs at most once per sweepEvery, so a flood
// of new keys at the cap costs one scan a minute, not one per request.
func (l *Limiter) sweep(now time.Time) {
	l.swept = now
	for k, b := range l.buckets {
		if now.Sub(b.lastSeen) > idleAfter {
			delete(l.buckets, k)
		}
	}
}

func (l *Limiter) size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.buckets)
}
