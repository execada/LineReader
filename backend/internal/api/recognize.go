package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime"
	"net/http"
	"regexp"
	"sync"

	"sverka/backend/internal/ocr"
)

// Limits from docs/api.md.
const (
	maxBodyBytes   = 10 << 20
	maxRegionBytes = 1 << 20
	maxMetaBytes   = 64 << 10
	maxRegions     = 20
	maxLanguages   = 5
	maxWidth       = 4000
	maxHeight      = 1000
)

var regionID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,32}$`)

type meta struct {
	Languages []string `json:"languages"`
	Regions   []struct {
		ID string `json:"id"`
	} `json:"regions"`
}

type region struct {
	id  string
	raw []byte
	img image.Image
}

type regionResult struct {
	ID string `json:"id"`
	ocr.Result
}

// requestError carries an HTTP status and a client-safe message.
type requestError struct {
	status  int
	code    string
	message string
}

func (e *requestError) Error() string { return e.message }

func invalid(format string, args ...any) *requestError {
	return &requestError{http.StatusBadRequest, codeInvalid, fmt.Sprintf(format, args...)}
}

func tooLarge(message string) *requestError {
	return &requestError{http.StatusRequestEntityTooLarge, codeTooLarge, message}
}

func (s *server) recognize(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	langs, regions, err := s.parseRecognize(r)
	defer wipe(regions)
	if err != nil {
		var re *requestError
		if errors.As(err, &re) {
			writeError(w, re.status, re.code, re.message)
			return
		}
		writeError(w, http.StatusBadRequest, codeInvalid, "malformed multipart body")
		return
	}
	setRegions(r.Context(), len(regions))

	// The middleware charged one token for the request; the rest of the regions cost one each.
	if key, ok := r.Context().Value(clientKeyKey{}).(string); ok && len(regions) > 1 {
		if !s.limiter.AllowN(key, len(regions)-1) {
			writeRateLimited(w, s.limiter, key)
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), s.timeout)
	defer cancel()
	results, err := s.recognizeAll(ctx, regions, langs)
	switch {
	case ctx.Err() != nil:
		writeError(w, http.StatusServiceUnavailable, codeTimeout, "recognition took too long, retry with fewer regions")
	case err != nil:
		writeError(w, http.StatusInternalServerError, codeInternal, "recognition failed")
	default:
		writeData(w, map[string]any{"engine": s.rec.Engine(), "regions": results})
	}
}

// recognizeAll runs regions concurrently; the OCR pool bounds real parallelism.
func (s *server) recognizeAll(ctx context.Context, regions []region, langs []string) ([]regionResult, error) {
	results := make([]regionResult, len(regions))
	errs := make([]error, len(regions))
	var wg sync.WaitGroup
	for i, reg := range regions {
		wg.Go(func() {
			res, err := s.rec.Recognize(ctx, reg.img, langs)
			results[i] = regionResult{ID: reg.id, Result: res}
			errs[i] = err
		})
	}
	wg.Wait()
	return results, errors.Join(errs...)
}

// parseRecognize streams the multipart body into memory. It never calls
// ParseMultipartForm, which spills large parts to temporary files.
func (s *server) parseRecognize(r *http.Request) ([]string, []region, error) {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/form-data" {
		return nil, nil, invalid("content type must be multipart/form-data")
	}
	mr, err := r.MultipartReader()
	if err != nil {
		return nil, nil, invalid("malformed multipart body")
	}

	var m *meta
	parts := map[string][]byte{}
	var order []region
	for {
		p, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, order, bodyError(err)
		}
		name := p.FormName()
		if name == "meta" {
			if m != nil {
				return nil, order, invalid("meta part sent twice")
			}
			m, err = readMeta(p)
			if err != nil {
				return nil, order, err
			}
			continue
		}
		if len(parts) >= maxRegions {
			return nil, order, invalid("at most %d regions per request", maxRegions)
		}
		if _, dup := parts[name]; dup || !regionID.MatchString(name) {
			return nil, order, invalid("bad or duplicate part name")
		}
		data, err := readLimited(p, maxRegionBytes)
		order = append(order, region{id: name, raw: data})
		if err != nil {
			return nil, order, err
		}
		parts[name] = data
	}

	if m == nil {
		return nil, order, invalid("meta part is required")
	}
	langs, err := s.checkLanguages(m.Languages)
	if err != nil {
		return nil, order, err
	}
	regions, err := matchRegions(m, parts)
	if err != nil {
		return nil, order, err
	}
	return langs, regions, nil
}

func readMeta(p io.Reader) (*meta, error) {
	data, err := readLimited(p, maxMetaBytes)
	if err != nil {
		return nil, err
	}
	var m meta
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, invalid("meta is not valid JSON")
	}
	return &m, nil
}

func (s *server) checkLanguages(langs []string) ([]string, error) {
	if len(langs) == 0 || len(langs) > maxLanguages {
		return nil, invalid("languages: 1 to %d codes from /v1/languages", maxLanguages)
	}
	seen := map[string]bool{}
	for _, l := range langs {
		if !s.allowed[l] {
			return nil, invalid("language %q is not installed, see /v1/languages", l)
		}
		if seen[l] {
			return nil, invalid("language %q is listed twice", l)
		}
		seen[l] = true
	}
	return langs, nil
}

func matchRegions(m *meta, parts map[string][]byte) ([]region, error) {
	if len(m.Regions) == 0 || len(m.Regions) > maxRegions {
		return nil, invalid("regions: 1 to %d entries", maxRegions)
	}
	seen := map[string]bool{}
	regions := make([]region, 0, len(m.Regions))
	for _, reg := range m.Regions {
		if !regionID.MatchString(reg.ID) || seen[reg.ID] {
			return nil, invalid("region ids must be unique, 1-32 of A-Z a-z 0-9 _ -")
		}
		seen[reg.ID] = true
		raw, ok := parts[reg.ID]
		if !ok {
			return nil, invalid("region %q has no image part", reg.ID)
		}
		img, err := decodeImage(raw)
		if err != nil {
			return regions, fmt.Errorf("region %q: %w", reg.ID, err)
		}
		regions = append(regions, region{id: reg.ID, raw: raw, img: img})
	}
	if len(parts) != len(regions) {
		return nil, invalid("every image part must be listed in meta.regions")
	}
	return regions, nil
}

// decodeImage checks the header, then fully decodes with Go's decoders, so a
// corrupt body is a 400 here and never reaches native code.
func decodeImage(raw []byte) (image.Image, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "png" && format != "jpeg") {
		return nil, invalid("region image must be PNG or JPEG")
	}
	if cfg.Width < 1 || cfg.Height < 1 || cfg.Width > maxWidth || cfg.Height > maxHeight {
		return nil, invalid("region image must be at most %d×%d px", maxWidth, maxHeight)
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, invalid("region image is corrupt")
	}
	return img, nil
}

// readLimited reads at most limit bytes; a longer part is a 413. The buffer
// is allocated once at full size so no grown-and-abandoned copies of the
// region are left behind for wipe to miss.
func readLimited(r io.Reader, limit int64) ([]byte, error) {
	buf := bytes.NewBuffer(make([]byte, 0, limit+1))
	_, err := buf.ReadFrom(io.LimitReader(r, limit+1))
	data := buf.Bytes()
	if err != nil {
		return data, bodyError(err)
	}
	if int64(len(data)) > limit {
		return data, tooLarge(fmt.Sprintf("a part is larger than %d bytes", limit))
	}
	return data, nil
}

func bodyError(err error) error {
	var mbe *http.MaxBytesError
	if errors.As(err, &mbe) {
		return tooLarge(fmt.Sprintf("request body is larger than %d bytes", maxBodyBytes))
	}
	return invalid("malformed multipart body")
}

// wipe zeroes region bytes and decoded pixels once the response is decided.
// In a garbage-collected runtime this shortens how long a region stays in
// memory; copies made while buffers grew are not reachable to zero.
func wipe(regions []region) {
	for _, r := range regions {
		clear(r.raw)
		switch img := r.img.(type) {
		case *image.Gray:
			clear(img.Pix)
		case *image.Gray16:
			clear(img.Pix)
		case *image.RGBA:
			clear(img.Pix)
		case *image.NRGBA:
			clear(img.Pix)
		case *image.RGBA64:
			clear(img.Pix)
		case *image.NRGBA64:
			clear(img.Pix)
		case *image.Paletted:
			clear(img.Pix)
		case *image.YCbCr:
			clear(img.Y)
			clear(img.Cb)
			clear(img.Cr)
		case *image.CMYK:
			clear(img.Pix)
		}
	}
}
