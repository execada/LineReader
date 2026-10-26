# syntax=docker/dockerfile:1.7
# Образ бэкенда «Сверки»: Go + libtesseract (Debian trixie) + модели tessdata_best.
ARG LANGS="rus eng deu pol tur ara chi_sim bel kaz"
# Коммит tessdata_best, к которому привязаны суммы в tessdata.sha256.
ARG TESSDATA_COMMIT=e12c65a915945e4c28e237a9b52bc4a8f39a0cec

FROM debian:trixie-slim AS tessdata
ARG LANGS
ARG TESSDATA_COMMIT
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /tessdata
COPY tessdata.sha256 /tmp/tessdata.sha256
RUN for l in $LANGS; do \
      curl -fsSL -o "$l.traineddata" "https://github.com/tesseract-ocr/tessdata_best/raw/$TESSDATA_COMMIT/$l.traineddata" || exit 1; \
      grep " $l.traineddata\$" /tmp/tessdata.sha256 | sha256sum -c - || exit 1; \
    done

FROM golang:1.26.9-trixie AS build
RUN apt-get update && apt-get install -y --no-install-recommends libtesseract-dev libleptonica-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/sverka-server ./cmd/server

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends libtesseract5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home --uid 10001 sverka
COPY --from=tessdata /tessdata /usr/share/sverka/tessdata
COPY --from=build /out/sverka-server /usr/local/bin/sverka-server
# OMP_THREAD_LIMIT=1: one thread per Tesseract client, parallelism comes from SVERKA_WORKERS.
ENV TESSDATA_PREFIX=/usr/share/sverka/tessdata SVERKA_ADDR=:8080 OMP_THREAD_LIMIT=1 GOMEMLIMIT=1500MiB
USER sverka
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["/usr/local/bin/sverka-server", "-healthcheck"]
ENTRYPOINT ["/usr/local/bin/sverka-server"]
