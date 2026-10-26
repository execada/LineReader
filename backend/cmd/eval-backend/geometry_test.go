package main

import (
	"image"
	"image/color"
	"math"
	"testing"
)

func near(a, b [2]float64) bool { return math.Abs(a[0]-b[0]) < 1e-9 && math.Abs(a[1]-b[1]) < 1e-9 }

func TestGrowAxisAligned(t *testing.T) {
	q := grow([][2]int{{10, 10}, {110, 10}, {110, 40}, {10, 40}}, 5)
	want := [4][2]float64{{5, 5}, {115, 5}, {115, 45}, {5, 45}}
	for i := range q {
		if !near(q[i], want[i]) {
			t.Errorf("corner %d = %v, want %v", i, q[i], want[i])
		}
	}
}

func TestGrowInwardIsClamped(t *testing.T) {
	q := grow([][2]int{{0, 0}, {100, 0}, {100, 8}, {0, 8}}, -6)
	if q[0][1] >= q[3][1] || q[0][0] >= q[1][0] {
		t.Errorf("cell turned inside out: %v", q)
	}
	if !near(q[0], [2]float64{2, 2}) {
		t.Errorf("top-left = %v, want pad clamped to a quarter of the height (2, 2)", q[0])
	}
}

func TestGrowRotatedKeepsEdgeDistance(t *testing.T) {
	// A square rotated by 45°: corners move by pad along each edge, so the
	// grown side is longer by exactly 2*pad.
	s := 50.0
	pts := [][2]int{{100, 0}, {100 + int(s), int(s)}, {100, 2 * int(s)}, {100 - int(s), int(s)}}
	q := grow(pts, 5)
	side := dist(q[0], q[1])
	if math.Abs(side-(math.Hypot(s, s)+10)) > 1e-6 {
		t.Errorf("side = %v, want %v", side, math.Hypot(s, s)+10)
	}
}

func TestWarpUprightCopy(t *testing.T) {
	src := image.NewGray(image.Rect(0, 0, 40, 20))
	for i := range src.Pix {
		src.Pix[i] = 0xff
	}
	for x := 10; x < 30; x++ {
		src.SetGray(x, 10, color.Gray{Y: 0})
	}
	out := warp(src, polygon{Polygon: [][2]int{{0, 0}, {40, 0}, {40, 20}, {0, 20}}})
	if out.Bounds().Dx() != 40 || out.Bounds().Dy() != 20 {
		t.Fatalf("size = %v", out.Bounds())
	}
	if out.GrayAt(20, 10).Y != 0 || out.GrayAt(5, 5).Y != 0xff {
		t.Errorf("pixels not copied: dark=%d light=%d", out.GrayAt(20, 10).Y, out.GrayAt(5, 5).Y)
	}
}

func TestWithPadRejectsNonQuads(t *testing.T) {
	if _, err := withPad([]polygon{{Polygon: [][2]int{{0, 0}, {1, 1}}}}, nil); err == nil {
		t.Error("two-point polygon: want error")
	}
}
