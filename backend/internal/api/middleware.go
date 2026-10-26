package api

import (
	"context"
	"crypto/subtle"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"sverka/backend/internal/limits"
)

type regionsKey struct{}

type clientKeyKey struct{}

// regionCount lets the handler report how many regions a request carried;
// it is the only request detail that reaches the log.
type regionCount struct{ n int }

func setRegions(ctx context.Context, n int) {
	if c, ok := ctx.Value(regionsKey{}).(*regionCount); ok {
		c.n = n
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// requestLog writes one line per request: method, status, duration, region count.
// No path, address, header, language or content is logged.
func requestLog(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		count := &regionCount{}
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r.WithContext(context.WithValue(r.Context(), regionsKey{}, count)))
		log.Info("request",
			slog.String("method", r.Method),
			slog.Int("status", rec.status),
			slog.Int64("duration_ms", time.Since(start).Milliseconds()),
			slog.Int("regions", count.n),
		)
	})
}

// recoverer turns a panic into a 500; the panic value is not logged, it may hold document text.
func recoverer(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v)
				}
				log.Error("panic recovered")
				writeError(w, http.StatusInternalServerError, codeInternal, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// rateLimit runs before the token check so guessing tokens costs the same budget.
func rateLimit(l *limits.Limiter, trustProxy bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := clientKey(r, trustProxy)
		if !l.Allow(key) {
			writeRateLimited(w, l, key)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), clientKeyKey{}, key)))
	})
}

func writeRateLimited(w http.ResponseWriter, l *limits.Limiter, key string) {
	w.Header().Set("Retry-After", strconv.Itoa(int(max(l.RetryAfter(key), time.Second).Seconds())))
	writeError(w, http.StatusTooManyRequests, codeRateLimited, "too many requests, retry later")
}

// inFlight answers 503 when max requests are already being served, before any body is read.
func inFlight(maxRequests int, next http.Handler) http.Handler {
	slots := make(chan struct{}, maxRequests)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
			next.ServeHTTP(w, r)
		default:
			w.Header().Set("Retry-After", "2")
			writeError(w, http.StatusServiceUnavailable, codeBusy, "server is busy, retry later")
		}
	})
}

func requireToken(token string, next http.Handler) http.Handler {
	want := []byte("Bearer " + token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := []byte(r.Header.Get("Authorization"))
		if subtle.ConstantTimeCompare(got, want) != 1 {
			w.Header().Set("WWW-Authenticate", `Bearer realm="sverka"`)
			writeError(w, http.StatusUnauthorized, codeUnauthorized, "missing or invalid token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// methodGuard answers 405 in the envelope format, with Allow, instead of
// ServeMux's plain-text 405.
func methodGuard(mux *http.ServeMux) http.Handler {
	methods := []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, pattern := mux.Handler(r); pattern != "/v1/" {
			mux.ServeHTTP(w, r)
			return
		}
		var allowed []string
		probe := r.Clone(r.Context())
		for _, m := range methods {
			probe.Method = m
			if _, p := mux.Handler(probe); p != "/v1/" {
				allowed = append(allowed, m)
			}
		}
		if len(allowed) == 0 {
			mux.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Allow", strings.Join(allowed, ", "))
		writeError(w, http.StatusMethodNotAllowed, codeMethod, "method not allowed")
	})
}

// clientKey is the client IP; IPv6 clients are grouped by /64, the usual
// size of one subscriber's range. Behind a reverse proxy (Caddy) the rightmost
// X-Forwarded-For entry is the one the proxy itself appended; if it is not a
// valid IP the connection address is used.
func clientKey(r *http.Request, trustProxy bool) string {
	if trustProxy {
		hops := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		if addr, err := netip.ParseAddr(strings.TrimSpace(hops[len(hops)-1])); err == nil {
			return keyOf(addr)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return host
	}
	return keyOf(addr)
}

func keyOf(addr netip.Addr) string {
	addr = addr.Unmap()
	if addr.Is4() {
		return addr.String()
	}
	prefix, err := addr.Prefix(64)
	if err != nil {
		return addr.String()
	}
	return prefix.String()
}
