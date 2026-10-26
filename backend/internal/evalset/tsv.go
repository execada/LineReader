package evalset

import (
	"fmt"
	"io"
	"strconv"
	"strings"
)

// Columns of Tesseract's TSV output.
const (
	tsvLevel = iota
	tsvPage
	tsvBlock
	tsvPar
	tsvLine
	tsvWord
	tsvLeft
	tsvTop
	tsvWidth
	tsvHeight
	tsvConf
	tsvText
	tsvColumns
)

const tsvWordLevel = "5"

// parseTSV turns Tesseract's word rows into lines with a union bounding box,
// in Tesseract's own order, so they can be scored like Vision's lines.
func parseTSV(r io.Reader) ([]Line, error) {
	// Tesseract does not quote fields, and recognized words may contain '"',
	// so the file is split on tabs and newlines directly instead of with encoding/csv.
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read tsv: %w", err)
	}
	var rows [][]string
	for line := range strings.Lines(string(data)) {
		rows = append(rows, strings.Split(strings.TrimRight(line, "\r\n"), "\t"))
	}

	var lines []Line
	var words []string
	lastKey := ""
	for i, row := range rows {
		if i == 0 || len(row) < tsvColumns || row[tsvLevel] != tsvWordLevel || strings.TrimSpace(row[tsvText]) == "" {
			continue
		}
		box, err := tsvBox(row)
		if err != nil {
			return nil, fmt.Errorf("tsv row %d: %w", i+1, err)
		}
		key := strings.Join(row[tsvPage:tsvWord], "/")
		if key != lastKey {
			if len(lines) > 0 {
				lines[len(lines)-1].Text = strings.Join(words, " ")
			}
			lines = append(lines, Line{BBox: box})
			words = nil
			lastKey = key
		}
		last := &lines[len(lines)-1]
		last.BBox = union(last.BBox, box)
		words = append(words, row[tsvText])
	}
	if len(lines) > 0 {
		lines[len(lines)-1].Text = strings.Join(words, " ")
	}
	return lines, nil
}

func tsvBox(row []string) ([]int, error) {
	box := make([]int, 4)
	for i, col := range []int{tsvLeft, tsvTop, tsvWidth, tsvHeight} {
		v, err := strconv.Atoi(row[col])
		if err != nil {
			return nil, fmt.Errorf("bad box value %q: %w", row[col], err)
		}
		box[i] = v
	}
	return box, nil
}

func union(a, b []int) []int {
	left, top := min(a[0], b[0]), min(a[1], b[1])
	right, bottom := max(a[0]+a[2], b[0]+b[2]), max(a[1]+a[3], b[1]+b[3])
	return []int{left, top, right - left, bottom - top}
}
