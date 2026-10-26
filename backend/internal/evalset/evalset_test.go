package evalset

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"sverka/backend/internal/metrics"
)

const setDir = "testdata/set"

func TestLoadManifest(t *testing.T) {
	m, err := LoadManifest(filepath.Join(setDir, "manifest.json"))
	if err != nil {
		t.Fatalf("LoadManifest: %v", err)
	}
	if !m.Synthetic || len(m.Images) != 3 {
		t.Fatalf("got synthetic=%v images=%d, want true and 3", m.Synthetic, len(m.Images))
	}
	if got := m.Images[2].Name(); got != "table_ru_clean" {
		t.Errorf("Name() = %q, want table_ru_clean", got)
	}
}

func TestLoadManifestErrors(t *testing.T) {
	if _, err := LoadManifest("testdata/missing.json"); err == nil {
		t.Error("missing file: want error")
	}
	bad := filepath.Join(t.TempDir(), "bad.json")
	if err := os.WriteFile(bad, []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadManifest(bad); err == nil {
		t.Error("broken json: want error")
	}
}

func TestReference(t *testing.T) {
	text := Image{GroundTruth: "ground_truth/ru.txt", Lines: []TextLine{{Text: "ignored"}}}
	table := Image{Kind: "table", GroundTruth: "ground_truth/table_ru.csv", Lines: []TextLine{{Text: "Акт"}}}
	tests := []struct {
		name string
		im   Image
		want string
	}{
		{"text page uses ground truth file", text, "Счёт № 1\nИНН 6600\n"},
		{"table adds page lines above rows", table, "Акт\n№ Цена, руб.\n1 7 100,00"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Reference(setDir, tt.im)
			if err != nil {
				t.Fatalf("Reference: %v", err)
			}
			if got != tt.want {
				t.Errorf("Reference = %q, want %q", got, tt.want)
			}
		})
	}
	if _, err := Reference(setDir, Image{GroundTruth: "ground_truth/none.txt"}); err == nil {
		t.Error("missing reference: want error")
	}
}

func TestHypothesis(t *testing.T) {
	got, err := Hypothesis("testdata/results/vision", "ru_clean", false)
	if err != nil || got != "Счёт № 1\nИНН 66O0" {
		t.Errorf("json hypothesis = %q, %v", got, err)
	}
	got, err = Hypothesis("testdata/results/tess", "ru_clean", false)
	if err != nil || got != "Счёт № 1\n\nИНН 6600\n" {
		t.Errorf("txt hypothesis = %q, %v", got, err)
	}
	if _, err := Hypothesis("testdata/results/vision", "ru_lowlight", false); !errors.Is(err, ErrNoResult) {
		t.Errorf("missing result: err = %v, want ErrNoResult", err)
	}
}

func TestHypothesisFromTSV(t *testing.T) {
	got, err := Hypothesis("testdata/results/tsv", "table_ru_clean", false)
	if err != nil {
		t.Fatalf("Hypothesis: %v", err)
	}
	if want := "No. Title\n1 Rack\nQty\n\".- I”"; got != want {
		t.Errorf("tsv in engine order = %q, want %q", got, want)
	}
	got, err = Hypothesis("testdata/results/tsv", "table_ru_clean", true)
	if err != nil {
		t.Fatalf("Hypothesis: %v", err)
	}
	if want := "No. Title Qty\n1 Rack\n\".- I”"; got != want {
		t.Errorf("tsv as table = %q, want %q", got, want)
	}
}

func TestHypothesisRejectsJSONWithoutLines(t *testing.T) {
	if _, err := Hypothesis("testdata/results", "broken", false); err == nil || errors.Is(err, ErrNoResult) {
		t.Errorf("json without lines: err = %v, want a parse error", err)
	}
}

func TestRowOrderTiltedRows(t *testing.T) {
	// Rows tilted by a few pixels per cell, as on photo_perspective tables.
	lines := []Line{
		{Text: "a1", BBox: []int{0, 100, 50, 30}},
		{Text: "a2", BBox: []int{100, 108, 50, 30}},
		{Text: "a3", BBox: []int{200, 116, 50, 30}},
		{Text: "b1", BBox: []int{0, 150, 50, 30}},
		{Text: "b2", BBox: []int{100, 158, 50, 30}},
		{Text: "tall", BBox: []int{300, 95, 50, 110}},
	}
	got := RowOrder(lines)
	want := "a1 a2 a3\ntall\nb1 b2"
	if got != want {
		t.Errorf("RowOrder = %q, want %q", got, want)
	}
}

func TestReferenceToleratesBOMAndRaggedRows(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "gt"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "gt", "t.csv"), []byte("\ufeffa,b\nc\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := Reference(dir, Image{Kind: "table", GroundTruth: "gt/t.csv"})
	if err != nil || got != "a b\nc" {
		t.Errorf("Reference = %q, %v; want \"a b\\nc\"", got, err)
	}
}

func TestRowOrder(t *testing.T) {
	lines := []Line{
		{Text: "No.", BBox: []int{10, 100, 40, 20}},
		{Text: "Description", BBox: []int{100, 102, 200, 20}},
		{Text: "1", BBox: []int{10, 140, 10, 20}},
		{Text: "Title", BBox: []int{10, 10, 300, 30}},
		{Text: "Rack", BBox: []int{100, 138, 120, 22}},
	}
	got := RowOrder(lines)
	want := "Title\nNo. Description\n1 Rack"
	if got != want {
		t.Errorf("RowOrder = %q, want %q", got, want)
	}
}

func TestScore(t *testing.T) {
	m, err := LoadManifest(filepath.Join(setDir, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	scores, err := Score(m, setDir, "testdata/results/tess")
	if err != nil {
		t.Fatalf("Score: %v", err)
	}
	if len(scores) != 3 {
		t.Fatalf("got %d scores, want 3", len(scores))
	}
	if scores[0].CER.Edits != 0 || scores[2].CER.Edits != 0 {
		t.Errorf("clean pages should be exact: %+v %+v", scores[0].CER, scores[2].CER)
	}
	if scores[1].CER.Edits == 0 || scores[1].Missing {
		t.Errorf("lowlight should have errors: %+v", scores[1])
	}

	partial, err := Score(m, setDir, "testdata/results/vision")
	if err != nil {
		t.Fatalf("Score with missing results: %v", err)
	}
	if !partial[1].Missing || partial[0].CER.Edits != 1 {
		t.Errorf("want missing lowlight and one edit on clean, got %+v", partial)
	}
}

func TestMarkdownTable(t *testing.T) {
	scores := []ImageScore{
		{Doc: "ru", Variant: "clean", CER: cer(1, 100), WER: cer(1, 20)},
		{Doc: "ru", Variant: "lowlight", Missing: true},
		{Doc: "en", Variant: "clean", CER: cer(0, 50), WER: cer(0, 10)},
	}
	got := MarkdownTable(scores, []string{"clean", "lowlight"})
	for _, want := range []string{
		"| документ | clean | lowlight |",
		"| ru | 1.0 % | нет данных |",
		"| en | 0.0 % | — |",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("table missing %q:\n%s", want, got)
		}
	}
}

func cer(edits, refLen int) metrics.Result {
	return metrics.Result{Edits: edits, RefLen: refLen, Rate: float64(edits) / float64(refLen)}
}
