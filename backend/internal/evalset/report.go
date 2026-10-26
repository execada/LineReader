package evalset

import (
	"fmt"
	"strings"

	"sverka/backend/internal/metrics"
)

// MarkdownTable renders CER per document (rows) and variant (columns).
// "нет данных" means the engine produced no result; "—" means the set has no such image.
func MarkdownTable(scores []ImageScore, variants []string) string {
	var docs []string
	cells := map[string]map[string]string{}
	for _, s := range scores {
		if _, ok := cells[s.Doc]; !ok {
			docs = append(docs, s.Doc)
			cells[s.Doc] = map[string]string{}
		}
		cells[s.Doc][s.Variant] = formatCell(s)
	}

	var b strings.Builder
	b.WriteString("| документ | " + strings.Join(variants, " | ") + " |\n")
	b.WriteString("|---" + strings.Repeat("|---", len(variants)) + "|\n")
	for _, doc := range docs {
		row := make([]string, len(variants))
		for i, v := range variants {
			cell, ok := cells[doc][v]
			if !ok {
				cell = "—"
			}
			row[i] = cell
		}
		b.WriteString("| " + doc + " | " + strings.Join(row, " | ") + " |\n")
	}
	return b.String()
}

func formatCell(s ImageScore) string {
	if s.Missing {
		return "нет данных"
	}
	return percent(s.CER)
}

func percent(r metrics.Result) string {
	return fmt.Sprintf("%.1f %%", r.Rate*100)
}
