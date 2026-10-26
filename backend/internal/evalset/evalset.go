// Package evalset scores OCR results against the eval manifest and ground truth.
package evalset

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"sverka/backend/internal/metrics"
)

// ErrNoResult means the engine produced no output file for an image.
var ErrNoResult = errors.New("no result for image")

type Manifest struct {
	Synthetic bool    `json:"synthetic"`
	Images    []Image `json:"images"`
}

type Image struct {
	File        string     `json:"file"`
	Doc         string     `json:"doc"`
	Kind        string     `json:"kind"`
	Variant     string     `json:"variant"`
	Synthetic   bool       `json:"synthetic"`
	Languages   []string   `json:"languages"`
	GroundTruth string     `json:"ground_truth"`
	Lines       []TextLine `json:"lines"`
}

// TextLine is a line printed on the page, as listed in the manifest.
type TextLine struct {
	Text string `json:"text"`
}

// Name is the file name without directory and extension, the key for result files.
func (im Image) Name() string {
	base := filepath.Base(im.File)
	return strings.TrimSuffix(base, filepath.Ext(base))
}

type ImageScore struct {
	Name      string         `json:"name"`
	Doc       string         `json:"doc"`
	Variant   string         `json:"variant"`
	Synthetic bool           `json:"synthetic"`
	Missing   bool           `json:"missing"`
	CER       metrics.Result `json:"cer"`
	WER       metrics.Result `json:"wer"`
}

func LoadManifest(path string) (Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Manifest{}, fmt.Errorf("read manifest: %w", err)
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return Manifest{}, fmt.Errorf("parse manifest %s: %w", path, err)
	}
	return m, nil
}

// Reference returns the ground truth text. For a table, the page lines above
// it come first, then one line per CSV row with cells joined by a space,
// which is how a line-based OCR reads it.
func Reference(setDir string, im Image) (string, error) {
	path := filepath.Join(setDir, im.GroundTruth)
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read reference: %w", err)
	}
	if im.Kind != "table" {
		return strings.TrimPrefix(string(data), "\ufeff"), nil
	}
	reader := csv.NewReader(strings.NewReader(strings.TrimPrefix(string(data), "\ufeff")))
	reader.FieldsPerRecord = -1
	rows, err := reader.ReadAll()
	if err != nil {
		return "", fmt.Errorf("parse table %s: %w", path, err)
	}
	lines := make([]string, 0, len(im.Lines)+len(rows))
	for _, l := range im.Lines {
		lines = append(lines, l.Text)
	}
	for _, row := range rows {
		lines = append(lines, strings.Join(row, " "))
	}
	return strings.Join(lines, "\n"), nil
}

// Line is one recognized line; BBox is [x, y, w, h] in pixels from the top left.
type Line struct {
	Text string `json:"text"`
	BBox []int  `json:"bbox"`
}

type jsonResult struct {
	Lines *[]Line `json:"lines"`
}

// Hypothesis reads the first of <name>.json, <name>.tsv (Tesseract) or
// <name>.txt in dir. Lines with boxes keep engine order, except for tables,
// where they are regrouped into rows (see RowOrder) for every engine alike.
func Hypothesis(dir, name string, table bool) (string, error) {
	lines, err := boxedLines(dir, name)
	if err == nil {
		if table {
			return RowOrder(lines), nil
		}
		texts := make([]string, len(lines))
		for i, l := range lines {
			texts[i] = l.Text
		}
		return strings.Join(texts, "\n"), nil
	}
	if !errors.Is(err, fs.ErrNotExist) {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(dir, name+".txt"))
	if errors.Is(err, fs.ErrNotExist) {
		return "", fmt.Errorf("%s: %w", name, ErrNoResult)
	}
	if err != nil {
		return "", fmt.Errorf("read result %s: %w", name, err)
	}
	return string(data), nil
}

func boxedLines(dir, name string) ([]Line, error) {
	data, err := os.ReadFile(filepath.Join(dir, name+".json"))
	if err == nil {
		var r jsonResult
		if err := json.Unmarshal(data, &r); err != nil {
			return nil, fmt.Errorf("parse result %s: %w", name, err)
		}
		if r.Lines == nil {
			return nil, fmt.Errorf("result %s: no \"lines\" key", name)
		}
		return *r.Lines, nil
	}
	if !errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("read result %s: %w", name, err)
	}
	f, err := os.Open(filepath.Join(dir, name+".tsv"))
	if err != nil {
		return nil, fmt.Errorf("read result %s: %w", name, err)
	}
	defer f.Close()
	lines, err := parseTSV(f)
	if err != nil {
		return nil, fmt.Errorf("result %s: %w", name, err)
	}
	return lines, nil
}

// Score compares every image in the manifest; images without a result are marked Missing.
func Score(m Manifest, setDir, resultsDir string) ([]ImageScore, error) {
	scores := make([]ImageScore, 0, len(m.Images))
	for _, im := range m.Images {
		s := ImageScore{Name: im.Name(), Doc: im.Doc, Variant: im.Variant, Synthetic: im.Synthetic}
		ref, err := Reference(setDir, im)
		if err != nil {
			return nil, err
		}
		hyp, err := Hypothesis(resultsDir, s.Name, im.Kind == "table")
		switch {
		case errors.Is(err, ErrNoResult):
			s.Missing = true
		case err != nil:
			return nil, err
		default:
			s.CER = metrics.CER(ref, hyp)
			s.WER = metrics.WER(ref, hyp)
		}
		scores = append(scores, s)
	}
	return scores, nil
}
