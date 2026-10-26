package api

import (
	"encoding/json"
	"net/http"
)

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type envelope struct {
	Success bool      `json:"success"`
	Data    any       `json:"data"`
	Error   *apiError `json:"error"`
}

// Error codes returned to clients. Messages never include document content.
const (
	codeInvalid      = "invalid_request"
	codeUnauthorized = "unauthorized"
	codeTooLarge     = "too_large"
	codeRateLimited  = "rate_limited"
	codeNotFound     = "not_found"
	codeMethod       = "method_not_allowed"
	codeInternal     = "internal_error"
	codeBusy         = "busy"
	codeTimeout      = "timeout"
)

func writeData(w http.ResponseWriter, data any) {
	writeJSON(w, http.StatusOK, envelope{Success: true, Data: data})
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, envelope{Error: &apiError{Code: code, Message: message}})
}

func writeJSON(w http.ResponseWriter, status int, body envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
