# На macOS libtesseract и leptonica стоят в /opt/homebrew (brew install tesseract).
BREW := $(shell brew --prefix 2>/dev/null)
ifneq ($(BREW),)
export CGO_CPPFLAGS := -I$(BREW)/include
export CGO_LDFLAGS := -L$(BREW)/lib
endif

.PHONY: test vet lint run
test:
	go test -race -cover ./...
vet:
	go vet ./...
lint: vet
	staticcheck ./...
run:
	TESSDATA_PREFIX=$(CURDIR)/../.tessdata go run ./cmd/server
