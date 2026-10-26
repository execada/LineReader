// Command eval-backend sends every line (and table cell) of the eval set to a
// running server as a separate region and writes <image>.json results that
// cmd/eval scores. Each region is the manifest's reference quadrilateral warped
// to an upright rectangle, as the app does with Vision's line quads, so the
// numbers measure recognition of a correctly found line, not line finding.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "image/jpeg"
)

const (
	batchSize = 20
	// Lines are grown to keep ascenders and descenders; table cells are shrunk
	// so the grid lines around them stay out of the crop.
	linePad = 6
	cellPad = -6
)

type manifest struct {
	Images []struct {
		File           string    `json:"file"`
		TesseractLangs string    `json:"tesseract_langs"`
		Lines          []polygon `json:"lines"`
		Cells          []polygon `json:"cells"`
	} `json:"images"`
}

type polygon struct {
	Polygon [][2]int `json:"polygon"`
	pad     float64
}

type line struct {
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
	BBox       []int   `json:"bbox"`
}

type apiResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Engine  string `json:"engine"`
		Regions []struct {
			ID         string  `json:"id"`
			Text       string  `json:"text"`
			Confidence float64 `json:"confidence"`
		} `json:"regions"`
	} `json:"data"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func main() {
	setDir := flag.String("set", "../eval/synthetic", "eval set directory")
	url := flag.String("url", "http://localhost:8080", "server base URL")
	out := flag.String("out", "../eval/results/raw/backend", "output directory")
	flag.Parse()
	token := os.Getenv("SVERKA_TOKEN")
	if token == "" {
		fmt.Fprintln(os.Stderr, "eval-backend: SVERKA_TOKEN is required")
		os.Exit(2)
	}
	if err := run(*setDir, *url, *out, token); err != nil {
		fmt.Fprintln(os.Stderr, "eval-backend:", err)
		os.Exit(1)
	}
}

func run(setDir, url, out, token string) error {
	data, err := os.ReadFile(filepath.Join(setDir, "manifest.json"))
	if err != nil {
		return fmt.Errorf("read manifest: %w", err)
	}
	var m manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("parse manifest: %w", err)
	}
	if err := os.MkdirAll(out, 0o755); err != nil {
		return err
	}
	client := &http.Client{Timeout: 120 * time.Second}
	for _, im := range m.Images {
		img, err := loadImage(filepath.Join(setDir, im.File))
		if err != nil {
			return err
		}
		langs := strings.Split(im.TesseractLangs, "+")
		polys, err := withPad(im.Lines, im.Cells)
		if err != nil {
			return fmt.Errorf("%s: %w", im.File, err)
		}
		lines, err := recognizeAll(client, url, token, img, polys, langs)
		if err != nil {
			return fmt.Errorf("%s: %w", im.File, err)
		}
		name := strings.TrimSuffix(filepath.Base(im.File), filepath.Ext(im.File))
		if err := writeResult(filepath.Join(out, name+".json"), lines); err != nil {
			return err
		}
		fmt.Println(name, len(lines))
	}
	return nil
}

func loadImage(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, _, err := image.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return img, nil
}

// withPad tags lines and cells with their padding; anything that is not a
// quadrilateral is an error in the manifest.
func withPad(lines, cells []polygon) ([]polygon, error) {
	out := make([]polygon, 0, len(lines)+len(cells))
	for _, group := range []struct {
		polys []polygon
		pad   float64
	}{{lines, linePad}, {cells, cellPad}} {
		for _, p := range group.polys {
			if len(p.Polygon) != 4 {
				return nil, fmt.Errorf("polygon with %d points, want 4", len(p.Polygon))
			}
			out = append(out, polygon{Polygon: p.Polygon, pad: group.pad})
		}
	}
	return out, nil
}

func boundsOf(p polygon) image.Rectangle {
	r := image.Rect(p.Polygon[0][0], p.Polygon[0][1], p.Polygon[0][0], p.Polygon[0][1])
	for _, pt := range p.Polygon[1:] {
		r = r.Union(image.Rect(pt[0], pt[1], pt[0]+1, pt[1]+1))
	}
	return r
}

// warp maps the quad (top-left, top-right, bottom-right, bottom-left), grown by
// p.pad, onto an upright gray image by bilinear interpolation of the corners.
func warp(img image.Image, p polygon) *image.Gray {
	q := grow(p.Polygon, p.pad)
	w := int(math.Round(max(dist(q[0], q[1]), dist(q[3], q[2]))))
	h := int(math.Round(max(dist(q[0], q[3]), dist(q[1], q[2]))))
	out := image.NewGray(image.Rect(0, 0, max(w, 1), max(h, 1)))
	b := img.Bounds()
	for y := range out.Rect.Dy() {
		v := (float64(y) + 0.5) / float64(out.Rect.Dy())
		for x := range out.Rect.Dx() {
			u := (float64(x) + 0.5) / float64(out.Rect.Dx())
			sx := (1-v)*((1-u)*q[0][0]+u*q[1][0]) + v*((1-u)*q[3][0]+u*q[2][0])
			sy := (1-v)*((1-u)*q[0][1]+u*q[1][1]) + v*((1-u)*q[3][1]+u*q[2][1])
			pt := image.Pt(int(math.Floor(sx)), int(math.Floor(sy)))
			if pt.In(b) {
				out.Set(x, y, img.At(pt.X, pt.Y))
			} else {
				out.SetGray(x, y, color.Gray{Y: 0xff})
			}
		}
	}
	return out
}

// grow moves each corner along the quad's own edges by pad pixels: outwards
// if pad > 0, inwards if pad < 0. An inward pad is clamped so a small cell
// never turns inside out.
func grow(pts [][2]int, pad float64) [4][2]float64 {
	var q [4][2]float64
	for i, p := range pts {
		q[i] = [2]float64{float64(p[0]), float64(p[1])}
	}
	w := min(dist(q[0], q[1]), dist(q[3], q[2]))
	h := min(dist(q[0], q[3]), dist(q[1], q[2]))
	pad = max(pad, -0.25*min(w, h))
	ux, vx := unit(q[0], q[1]), unit(q[3], q[2])
	uy, vy := unit(q[0], q[3]), unit(q[1], q[2])
	return [4][2]float64{
		{q[0][0] - pad*(ux[0]+uy[0]), q[0][1] - pad*(ux[1]+uy[1])},
		{q[1][0] + pad*(ux[0]-vy[0]), q[1][1] + pad*(ux[1]-vy[1])},
		{q[2][0] + pad*(vx[0]+vy[0]), q[2][1] + pad*(vx[1]+vy[1])},
		{q[3][0] - pad*(vx[0]-uy[0]), q[3][1] - pad*(vx[1]-uy[1])},
	}
}

func unit(a, b [2]float64) [2]float64 {
	d := dist(a, b)
	if d == 0 {
		return [2]float64{}
	}
	return [2]float64{(b[0] - a[0]) / d, (b[1] - a[1]) / d}
}

func dist(a, b [2]float64) float64 { return math.Hypot(a[0]-b[0], a[1]-b[1]) }

func recognizeAll(c *http.Client, url, token string, img image.Image, polys []polygon, langs []string) ([]line, error) {
	var lines []line
	for start := 0; start < len(polys); start += batchSize {
		batch := polys[start:min(start+batchSize, len(polys))]
		rects := make([]image.Rectangle, len(batch))
		crops := make([][]byte, len(batch))
		for i, p := range batch {
			rects[i] = boundsOf(p)
			var buf bytes.Buffer
			if err := png.Encode(&buf, warp(img, p)); err != nil {
				return nil, err
			}
			crops[i] = buf.Bytes()
		}
		resp, err := send(c, url, token, crops, langs)
		if err != nil {
			return nil, err
		}
		for i, r := range resp.Data.Regions {
			rect := rects[i]
			lines = append(lines, line{Text: r.Text, Confidence: r.Confidence,
				BBox: []int{rect.Min.X, rect.Min.Y, rect.Dx(), rect.Dy()}})
		}
	}
	return lines, nil
}

func send(c *http.Client, url, token string, crops [][]byte, langs []string) (apiResponse, error) {
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	regions := make([]map[string]string, len(crops))
	for i := range crops {
		regions[i] = map[string]string{"id": fmt.Sprintf("r%d", i)}
	}
	meta, _ := json.Marshal(map[string]any{"languages": langs, "regions": regions})
	if err := w.WriteField("meta", string(meta)); err != nil {
		return apiResponse{}, err
	}
	for i, crop := range crops {
		fw, err := w.CreateFormFile(fmt.Sprintf("r%d", i), "region.png")
		if err != nil {
			return apiResponse{}, err
		}
		if _, err := fw.Write(crop); err != nil {
			return apiResponse{}, err
		}
	}
	if err := w.Close(); err != nil {
		return apiResponse{}, err
	}

	for attempt := 0; ; attempt++ {
		req, err := http.NewRequest(http.MethodPost, url+"/v1/regions:recognize", bytes.NewReader(body.Bytes()))
		if err != nil {
			return apiResponse{}, err
		}
		req.Header.Set("Content-Type", w.FormDataContentType())
		req.Header.Set("Authorization", "Bearer "+token)
		res, err := c.Do(req)
		if err != nil {
			return apiResponse{}, err
		}
		raw, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err != nil {
			return apiResponse{}, err
		}
		if res.StatusCode == http.StatusTooManyRequests && attempt < 5 {
			time.Sleep(2 * time.Second)
			continue
		}
		var out apiResponse
		if err := json.Unmarshal(raw, &out); err != nil {
			return apiResponse{}, fmt.Errorf("status %d, not JSON: %w", res.StatusCode, err)
		}
		if !out.Success {
			return apiResponse{}, fmt.Errorf("status %d: %+v", res.StatusCode, out.Error)
		}
		for i, r := range out.Data.Regions {
			if r.ID != fmt.Sprintf("r%d", i) || len(out.Data.Regions) != len(crops) {
				return apiResponse{}, fmt.Errorf("response regions do not match the request")
			}
		}
		return out, nil
	}
}

func writeResult(path string, lines []line) error {
	data, err := json.MarshalIndent(map[string]any{"engine": "backend", "lines": lines}, "", " ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
