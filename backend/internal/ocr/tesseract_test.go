package ocr

import (
	"context"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

func tessdataDir(t *testing.T) string {
	t.Helper()
	dir := os.Getenv("TESSDATA_PREFIX")
	if dir == "" {
		dir = "../../../.tessdata"
	}
	if _, err := os.Stat(filepath.Join(dir, "rus.traineddata")); err != nil {
		t.Skipf("tessdata with rus not found in %s", dir)
	}
	return dir
}

// cropLine cuts one printed line out of a clean synthetic page.
func cropLine(t *testing.T, page string, rect image.Rectangle) image.Image {
	t.Helper()
	f, err := os.Open(filepath.Join("../../../eval/synthetic/images", page))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		t.Fatal(err)
	}
	return img.(interface {
		SubImage(image.Rectangle) image.Image
	}).SubImage(rect)
}

// Line 3 of ru_clean.png: "Исполнитель: ООО «Северный Мост», ИНН 6600123450, КПП 660001001."
var ruLine = image.Rect(96, 326, 1080, 380)

func TestInstalledLanguages(t *testing.T) {
	dir := tessdataDir(t)
	langs, err := InstalledLanguages(dir)
	if err != nil {
		t.Fatalf("InstalledLanguages: %v", err)
	}
	if !slices.Contains(langs, "rus") || slices.Contains(langs, "osd") {
		t.Errorf("languages = %v, want rus present and osd excluded", langs)
	}
	if !slices.IsSorted(langs) {
		t.Errorf("languages not sorted: %v", langs)
	}
	if _, err := InstalledLanguages(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Error("missing dir: want error")
	}
}

func TestRecognizeLine(t *testing.T) {
	pool, err := NewPool(tessdataDir(t), 1)
	if err != nil {
		t.Fatalf("NewPool: %v", err)
	}
	defer pool.Close()

	res, err := pool.Recognize(context.Background(), cropLine(t, "ru_clean.png", ruLine), []string{"rus"})
	if err != nil {
		t.Fatalf("Recognize: %v", err)
	}
	if !strings.Contains(res.Text, "Северный Мост") || !strings.Contains(res.Text, "6600123450") {
		t.Errorf("text = %q", res.Text)
	}
	if res.Confidence <= 0.5 || res.Confidence > 1 {
		t.Errorf("confidence = %v, want in (0.5, 1]", res.Confidence)
	}
	if len(res.Words) < 6 {
		t.Fatalf("got %d words, want at least 6", len(res.Words))
	}
	for _, w := range res.Words {
		if w.Text == "" || w.Confidence < 0 || w.Confidence > 1 || w.BBox[2] <= 0 || w.BBox[3] <= 0 {
			t.Errorf("bad word %+v", w)
		}
	}
	if !strings.HasPrefix(pool.Engine(), "tesseract-5.") {
		t.Errorf("engine = %q", pool.Engine())
	}
}

func TestRecognizeErrors(t *testing.T) {
	pool, err := NewPool(tessdataDir(t), 1)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	if _, err := pool.Recognize(context.Background(), nil, []string{"rus"}); err == nil {
		t.Error("nil image: want error")
	}
	if _, err := pool.Recognize(context.Background(), image.NewGray(image.Rect(0, 0, 0, 0)), []string{"rus"}); err == nil {
		t.Error("empty image: want error")
	}
	if _, err := pool.Recognize(context.Background(), cropLine(t, "ru_clean.png", ruLine), []string{"xxx"}); err == nil {
		t.Error("unknown language: want error")
	}
	// The pool must still work after errors.
	if _, err := pool.Recognize(context.Background(), cropLine(t, "ru_clean.png", ruLine), []string{"rus"}); err != nil {
		t.Errorf("after errors: %v", err)
	}
}

func TestNoCarryOverBetweenRegions(t *testing.T) {
	pool, err := NewPool(tessdataDir(t), 1)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if _, err := pool.Recognize(context.Background(), cropLine(t, "ru_clean.png", ruLine), []string{"rus"}); err != nil {
		t.Fatal(err)
	}
	white := image.NewGray(image.Rect(0, 0, 400, 40))
	for i := range white.Pix {
		white.Pix[i] = 0xff
	}
	res, err := pool.Recognize(context.Background(), white, []string{"rus"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Text != "" || len(res.Words) != 0 {
		t.Errorf("blank region returned previous text: %+v", res)
	}
}

func TestCloseWaitsForBusyClients(t *testing.T) {
	pool, err := NewPool(tessdataDir(t), 1)
	if err != nil {
		t.Fatal(err)
	}
	busy := <-pool.clients
	done := make(chan struct{})
	go func() {
		pool.Close()
		close(done)
	}()
	select {
	case <-done:
		t.Fatal("Close returned while a client was in use")
	case <-time.After(100 * time.Millisecond):
	}
	pool.clients <- busy
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Close did not return after the client came back")
	}
}

func TestRecognizeWaitsForFreeClient(t *testing.T) {
	pool, err := NewPool(tessdataDir(t), 1)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	img := cropLine(t, "ru_clean.png", ruLine)

	busy := <-pool.clients
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := pool.Recognize(ctx, img, []string{"rus"}); err == nil {
		t.Error("all clients busy and context expired: want error")
	}
	pool.clients <- busy

	var wg sync.WaitGroup
	for range 3 {
		wg.Go(func() {
			if _, err := pool.Recognize(context.Background(), img, []string{"rus", "eng"}); err != nil {
				t.Errorf("concurrent Recognize: %v", err)
			}
		})
	}
	wg.Wait()
}

func TestNewPoolValidates(t *testing.T) {
	if _, err := NewPool(t.TempDir(), 1); err == nil {
		t.Error("empty tessdata dir: want error")
	}
	if _, err := NewPool(tessdataDir(t), 0); err == nil {
		t.Error("zero workers: want error")
	}
}
