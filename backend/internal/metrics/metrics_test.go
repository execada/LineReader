package metrics

import (
	"math"
	"testing"
)

func TestDistance(t *testing.T) {
	tests := []struct {
		name string
		a, b []string
		want int
	}{
		{"both empty", nil, nil, 0},
		{"insert all", nil, []string{"a", "b"}, 2},
		{"delete all", []string{"a", "b"}, nil, 2},
		{"equal", []string{"a", "b", "c"}, []string{"a", "b", "c"}, 0},
		{"substitute", []string{"k", "i", "t"}, []string{"k", "a", "t"}, 1},
		{"kitten sitting", split("kitten"), split("sitting"), 3},
		{"cyrillic vs latin lookalike", split("ООО"), split("OOO"), 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := distance(tt.a, tt.b); got != tt.want {
				t.Errorf("distance(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func split(s string) []string {
	out := make([]string, 0, len(s))
	for _, r := range s {
		out = append(out, string(r))
	}
	return out
}

func TestNormalize(t *testing.T) {
	tests := []struct {
		name, in, want string
	}{
		{"trims and collapses spaces", "  a   b\t c  ", "a b c"},
		{"drops empty lines", "a\n\n  \nb\n", "a\nb"},
		{"crlf", "a\r\nb", "a\nb"},
		{"nfc composes й", "й", "й"},
		{"keeps case and punctuation", "SN-7B0O-1l5I.", "SN-7B0O-1l5I."},
		{"drops spaces next to han", "上 海 ，2026 年 10 月", "上海，2026年10月"},
		{"keeps spaces between latin next to han", "编号 ab cd", "编号ab cd"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Normalize(tt.in); got != tt.want {
				t.Errorf("Normalize(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestCER(t *testing.T) {
	tests := []struct {
		name      string
		ref, hyp  string
		wantEdits int
		wantLen   int
		wantRate  float64
	}{
		{"perfect", "Привет мир", "Привет мир", 0, 10, 0},
		{"one substitution", "SN-7B0O", "SN-7BOO", 1, 7, 1.0 / 7},
		{"newline counts as one char", "ab\ncd", "ab cd", 1, 5, 0.2},
		{"normalized before compare", "a  b\n\nc", "a b\nc", 0, 5, 0},
		{"hyp longer than ref gives rate above 1", "ab", "abcdef", 4, 2, 2},
		{"multibyte runes counted once", "ё", "е", 1, 1, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CER(tt.ref, tt.hyp)
			if got.Edits != tt.wantEdits || got.RefLen != tt.wantLen || !near(got.Rate, tt.wantRate) {
				t.Errorf("CER(%q, %q) = %+v, want edits=%d len=%d rate=%v",
					tt.ref, tt.hyp, got, tt.wantEdits, tt.wantLen, tt.wantRate)
			}
		})
	}
}

func TestWER(t *testing.T) {
	tests := []struct {
		name      string
		ref, hyp  string
		wantEdits int
		wantLen   int
	}{
		{"perfect", "one two three", "one two three", 0, 3},
		{"one word wrong", "ИНН 6600123450 КПП", "ИНН 66O0123450 КПП", 1, 3},
		{"lines are word boundaries", "a b\nc", "a b c", 0, 3},
		{"missing word", "a b c", "a c", 1, 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := WER(tt.ref, tt.hyp)
			if got.Edits != tt.wantEdits || got.RefLen != tt.wantLen {
				t.Errorf("WER(%q, %q) = %+v, want edits=%d len=%d", tt.ref, tt.hyp, got, tt.wantEdits, tt.wantLen)
			}
		})
	}
}

func TestEmptyReference(t *testing.T) {
	if got := CER("", ""); got.Rate != 0 {
		t.Errorf("empty vs empty rate = %v, want 0", got.Rate)
	}
	if got := CER("", "abc"); got.Rate != 1 {
		t.Errorf("empty ref with text rate = %v, want 1", got.Rate)
	}
}

func TestSum(t *testing.T) {
	total := Sum([]Result{{Edits: 1, RefLen: 10}, {Edits: 3, RefLen: 10}})
	if total.Edits != 4 || total.RefLen != 20 || !near(total.Rate, 0.2) {
		t.Errorf("Sum = %+v, want edits=4 len=20 rate=0.2", total)
	}
	if empty := Sum(nil); empty.Rate != 0 {
		t.Errorf("Sum(nil).Rate = %v, want 0", empty.Rate)
	}
}

func near(a, b float64) bool { return math.Abs(a-b) < 1e-9 }
