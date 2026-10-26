// Package ocr recognizes image regions with Tesseract through gosseract.
package ocr

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/otiai10/gosseract/v2"
)

// Word is one recognized word; BBox is [x, y, w, h] in region pixels.
type Word struct {
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
	BBox       [4]int  `json:"bbox"`
}

// Result is a recognized region. Confidence is the mean word confidence
// weighted by word length, in [0, 1].
type Result struct {
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
	Words      []Word  `json:"words"`
}

// closeWait bounds how long Close waits for clients still inside Tesseract.
const closeWait = 30 * time.Second

// Pool holds a fixed number of Tesseract clients; one client serves one region at a time.
type Pool struct {
	clients chan *gosseract.Client
	all     []*gosseract.Client
	engine  string
}

// InstalledLanguages lists models (*.traineddata) in dir, sorted, without
// "osd", which detects orientation and is not a language.
func InstalledLanguages(dir string) ([]string, error) {
	paths, err := filepath.Glob(filepath.Join(dir, "*.traineddata"))
	if err != nil {
		return nil, fmt.Errorf("list tessdata: %w", err)
	}
	if _, err := os.Stat(dir); err != nil {
		return nil, fmt.Errorf("tessdata dir: %w", err)
	}
	langs := make([]string, 0, len(paths))
	for _, p := range paths {
		name := strings.TrimSuffix(filepath.Base(p), ".traineddata")
		if name != "osd" {
			langs = append(langs, name)
		}
	}
	slices.Sort(langs)
	return langs, nil
}

// NewPool creates workers clients reading models from tessdataDir.
func NewPool(tessdataDir string, workers int) (*Pool, error) {
	if workers < 1 {
		return nil, fmt.Errorf("workers must be at least 1, got %d", workers)
	}
	langs, err := InstalledLanguages(tessdataDir)
	if err != nil {
		return nil, err
	}
	if len(langs) == 0 {
		return nil, fmt.Errorf("no language models in %s", tessdataDir)
	}
	p := &Pool{clients: make(chan *gosseract.Client, workers)}
	for range workers {
		c := gosseract.NewClient()
		p.all = append(p.all, c)
		if err := errors.Join(
			c.SetTessdataPrefix(tessdataDir),
			c.SetPageSegMode(gosseract.PSM_SINGLE_LINE),
		); err != nil {
			p.closeAll()
			return nil, fmt.Errorf("configure tesseract: %w", err)
		}
		p.clients <- c
	}
	p.engine = "tesseract-" + p.all[0].Version()
	return p, nil
}

// Engine names the engine version, e.g. "tesseract-5.5.3".
func (p *Pool) Engine() string { return p.engine }

// Close waits (up to closeWait) until every client is back from Tesseract,
// then frees them; freeing a client in use would be a use-after-free in C.
// The pool must not be used afterwards.
func (p *Pool) Close() {
	timeout := time.After(closeWait)
	for range p.all {
		select {
		case <-p.clients:
		case <-timeout:
			return
		}
	}
	p.closeAll()
}

func (p *Pool) closeAll() {
	for _, c := range p.all {
		_ = c.Close()
	}
}

// Recognize reads one region image as a single text line. The image is
// re-encoded as an 8-bit grayscale PNG, so only Go's memory-safe decoders ever
// see client bytes. It waits for a free client until ctx is done.
func (p *Pool) Recognize(ctx context.Context, img image.Image, langs []string) (Result, error) {
	if img == nil || img.Bounds().Empty() {
		return Result{}, errors.New("empty image")
	}
	encoded, err := grayPNG(img)
	if err != nil {
		return Result{}, err
	}
	defer clear(encoded)

	var c *gosseract.Client
	select {
	case c = <-p.clients:
	case <-ctx.Done():
		return Result{}, fmt.Errorf("wait for tesseract: %w", ctx.Err())
	}
	defer func() { p.clients <- c }()

	res, err := recognizeWith(c, encoded, langs)
	if err != nil {
		// Init may have failed half-way; force a clean init on the next use.
		c.Languages = nil
		return Result{}, err
	}
	if err := scrub(c); err != nil {
		c.Languages = nil
	}
	return res, nil
}

func recognizeWith(c *gosseract.Client, img []byte, langs []string) (Result, error) {
	if !slices.Equal(c.Languages, langs) {
		if err := c.SetLanguage(langs...); err != nil {
			return Result{}, fmt.Errorf("set languages: %w", err)
		}
	}
	if err := c.SetImageFromBytes(img); err != nil {
		return Result{}, fmt.Errorf("set image: %w", err)
	}
	boxes, err := c.GetBoundingBoxes(gosseract.RIL_WORD)
	if err != nil {
		return Result{}, fmt.Errorf("recognize: %w", err)
	}
	text, err := c.Text()
	if err != nil {
		return Result{}, fmt.Errorf("read text: %w", err)
	}
	return toResult(strings.TrimSpace(text), boxes), nil
}

// scrub runs the client on a blank 1×1 image. gosseract hands a new image to
// Tesseract only when recognizing, so this is what replaces the region's
// pixels and recognized words inside Tesseract. Freed memory is not zeroed:
// this limits how long a region stays in the process, it does not erase it.
func scrub(c *gosseract.Client) error {
	if err := c.SetImageFromBytes(blankPNG); err != nil {
		return err
	}
	_, err := c.Text()
	return err
}

var blankPNG = func() []byte {
	img := image.NewGray(image.Rect(0, 0, 1, 1))
	img.Pix[0] = 0xff
	data, err := grayPNG(img)
	if err != nil {
		panic(err)
	}
	return data
}()

func grayPNG(img image.Image) ([]byte, error) {
	b := img.Bounds()
	gray := image.NewGray(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(gray, gray.Bounds(), img, b.Min, draw.Src)
	defer clear(gray.Pix)
	var buf bytes.Buffer
	if err := (&png.Encoder{CompressionLevel: png.BestSpeed}).Encode(&buf, gray); err != nil {
		return nil, fmt.Errorf("encode region: %w", err)
	}
	return buf.Bytes(), nil
}

func toResult(text string, boxes []gosseract.BoundingBox) Result {
	words := make([]Word, 0, len(boxes))
	var weighted, total float64
	for _, b := range boxes {
		t := strings.TrimSpace(b.Word)
		if t == "" {
			continue
		}
		conf := min(max(b.Confidence/100, 0), 1)
		words = append(words, Word{
			Text:       t,
			Confidence: conf,
			BBox:       [4]int{b.Box.Min.X, b.Box.Min.Y, b.Box.Dx(), b.Box.Dy()},
		})
		n := float64(utf8.RuneCountInString(t))
		weighted += conf * n
		total += n
	}
	res := Result{Text: text, Words: words}
	if total > 0 {
		res.Confidence = weighted / total
	}
	return res
}
