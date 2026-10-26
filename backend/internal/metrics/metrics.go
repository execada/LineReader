// Package metrics computes character and word error rates (CER, WER)
// between a reference text and a recognized hypothesis.
package metrics

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// Result is an edit count against a reference of RefLen units.
// Rate can exceed 1 when the hypothesis is much longer than the reference.
type Result struct {
	Edits  int     `json:"edits"`
	RefLen int     `json:"ref_len"`
	Rate   float64 `json:"rate"`
}

// Normalize applies NFC, unifies line endings, collapses whitespace inside
// each line and drops empty lines. Case and punctuation are kept: confusing
// O with 0 or l with I is exactly the kind of error the app must surface.
func Normalize(s string) string {
	s = norm.NFC.String(strings.ReplaceAll(s, "\r\n", "\n"))
	lines := strings.Split(s, "\n")
	kept := make([]string, 0, len(lines))
	for _, line := range lines {
		if f := strings.Fields(line); len(f) > 0 {
			kept = append(kept, joinWords(f))
		}
	}
	return strings.Join(kept, "\n")
}

// joinWords puts single spaces between words, except next to CJK characters:
// Chinese has no spaces, and engines insert them inconsistently.
func joinWords(words []string) string {
	var b strings.Builder
	for i, w := range words {
		if i > 0 && !isCJK(lastRune(words[i-1])) && !isCJK(firstRune(w)) {
			b.WriteByte(' ')
		}
		b.WriteString(w)
	}
	return b.String()
}

func isCJK(r rune) bool {
	return unicode.In(r, unicode.Han, unicode.Hiragana, unicode.Katakana) ||
		(r >= 0x3000 && r <= 0x303F) || (r >= 0xFF00 && r <= 0xFFEF)
}

func firstRune(s string) rune {
	for _, r := range s {
		return r
	}
	return 0
}

func lastRune(s string) rune {
	r := []rune(s)
	return r[len(r)-1]
}

// CER counts rune edits; a line break counts as one character.
func CER(ref, hyp string) Result {
	return compare(runes(Normalize(ref)), runes(Normalize(hyp)))
}

// WER counts word edits; words are split on any whitespace including line breaks.
func WER(ref, hyp string) Result {
	return compare(strings.Fields(Normalize(ref)), strings.Fields(Normalize(hyp)))
}

// Sum micro-averages results: total edits over total reference length.
func Sum(results []Result) Result {
	total := Result{}
	for _, r := range results {
		total.Edits += r.Edits
		total.RefLen += r.RefLen
	}
	return withRate(total.Edits, total.RefLen)
}

func compare(ref, hyp []string) Result {
	return withRate(distance(ref, hyp), len(ref))
}

func withRate(edits, refLen int) Result {
	switch {
	case refLen > 0:
		return Result{Edits: edits, RefLen: refLen, Rate: float64(edits) / float64(refLen)}
	case edits > 0:
		return Result{Edits: edits, RefLen: 0, Rate: 1}
	default:
		return Result{}
	}
}

func runes(s string) []string {
	out := make([]string, 0, len(s))
	for _, r := range s {
		out = append(out, string(r))
	}
	return out
}

// distance is the Levenshtein distance with unit costs, two rows of memory.
func distance(a, b []string) int {
	prev := make([]int, len(b)+1)
	curr := make([]int, len(b)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(a); i++ {
		curr[0] = i
		for j := 1; j <= len(b); j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			curr[j] = min(prev[j]+1, curr[j-1]+1, prev[j-1]+cost)
		}
		prev, curr = curr, prev
	}
	return prev[len(b)]
}
