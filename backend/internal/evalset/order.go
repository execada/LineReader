package evalset

import (
	"slices"
	"strings"
)

// RowOrder rebuilds left-to-right rows from line boxes; Vision returns table
// cells column by column. Lines are taken by vertical center; a line joins the
// current row when its center is within half the median line height of the
// row's mean center. Lines taller than twice the median (merged cells, whole
// blocks) form their own row. Lines without a box keep their order at the end.
func RowOrder(lines []Line) string {
	boxed := make([]Line, 0, len(lines))
	var unboxed []string
	for _, l := range lines {
		if len(l.BBox) == 4 {
			boxed = append(boxed, l)
		} else {
			unboxed = append(unboxed, l.Text)
		}
	}
	slices.SortStableFunc(boxed, func(a, b Line) int { return center(a) - center(b) })
	median := medianHeight(boxed)

	var rows [][]Line
	rowCenter := 0
	for _, l := range boxed {
		last := len(rows) - 1
		tall := l.BBox[3] > 2*median
		if last >= 0 && !tall && !isTall(rows[last], median) && abs(center(l)-rowCenter) <= median/2 {
			rows[last] = append(rows[last], l)
			rowCenter = meanCenter(rows[last])
			continue
		}
		rows = append(rows, []Line{l})
		rowCenter = center(l)
	}

	out := make([]string, 0, len(rows)+len(unboxed))
	for _, row := range rows {
		slices.SortStableFunc(row, func(a, b Line) int { return a.BBox[0] - b.BBox[0] })
		texts := make([]string, len(row))
		for i, l := range row {
			texts[i] = l.Text
		}
		out = append(out, strings.Join(texts, " "))
	}
	return strings.Join(append(out, unboxed...), "\n")
}

func center(l Line) int { return l.BBox[1] + l.BBox[3]/2 }

func meanCenter(row []Line) int {
	sum := 0
	for _, l := range row {
		sum += center(l)
	}
	return sum / len(row)
}

func isTall(row []Line, median int) bool {
	return len(row) == 1 && row[0].BBox[3] > 2*median
}

func medianHeight(lines []Line) int {
	if len(lines) == 0 {
		return 0
	}
	heights := make([]int, len(lines))
	for i, l := range lines {
		heights[i] = l.BBox[3]
	}
	slices.Sort(heights)
	return heights[len(heights)/2]
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
