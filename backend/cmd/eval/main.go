// Command eval scores one engine's OCR results against the eval set and
// prints a Markdown CER table; -json writes per-image scores.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"sverka/backend/internal/evalset"
	"sverka/backend/internal/metrics"
)

var variants = []string{"clean", "scan_skew", "photo_perspective", "lowlight", "blur_lowres"}

func main() {
	setDir := flag.String("set", "../eval/synthetic", "eval set directory with manifest.json")
	results := flag.String("results", "", "directory with <image>.json or <image>.txt results")
	label := flag.String("label", "", "engine and device label printed above the table")
	jsonOut := flag.String("json", "", "write per-image scores to this file")
	allowMissing := flag.Bool("allow-missing", false, "do not fail when some images have no result")
	flag.Parse()

	if err := run(*setDir, *results, *label, *jsonOut, *allowMissing); err != nil {
		fmt.Fprintln(os.Stderr, "eval:", err)
		os.Exit(1)
	}
}

func run(setDir, results, label, jsonOut string, allowMissing bool) error {
	if results == "" || label == "" {
		return fmt.Errorf("-results and -label are required")
	}
	m, err := evalset.LoadManifest(setDir + "/manifest.json")
	if err != nil {
		return err
	}
	scores, err := evalset.Score(m, setDir, results)
	if err != nil {
		return err
	}

	kind := "реальные документы"
	if m.Synthetic {
		kind = "синтетика"
	}
	fmt.Printf("### %s (%s)\n\nCER по документам и вариантам:\n\n", label, kind)
	fmt.Print(evalset.MarkdownTable(scores, variants))
	missing := printTotals(scores)

	if jsonOut != "" {
		if err := writeJSON(jsonOut, scores); err != nil {
			return err
		}
	}
	if missing > 0 && !allowMissing {
		return fmt.Errorf("%d images have no result; totals above exclude them (use -allow-missing to accept)", missing)
	}
	return nil
}

func writeJSON(jsonOut string, scores []evalset.ImageScore) error {
	data, err := json.MarshalIndent(scores, "", " ")
	if err != nil {
		return fmt.Errorf("encode scores: %w", err)
	}
	if err := os.WriteFile(jsonOut, data, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", jsonOut, err)
	}
	return nil
}

// printTotals prints per-variant totals and returns how many images had no result.
// WER for Chinese counts whole lines as words (no spaces), so it is left out of WER totals.
func printTotals(scores []evalset.ImageScore) int {
	fmt.Println("\nИтого по вариантам (CER / WER, взвешено по длине эталона; WER без zh):")
	fmt.Println()
	missing := 0
	for _, v := range variants {
		var cer, wer []metrics.Result
		total, absent := 0, 0
		for _, s := range scores {
			if s.Variant != v {
				continue
			}
			total++
			if s.Missing {
				absent++
				continue
			}
			cer = append(cer, s.CER)
			if s.Doc != "zh" {
				wer = append(wer, s.WER)
			}
		}
		missing += absent
		c, w := metrics.Sum(cer), metrics.Sum(wer)
		fmt.Printf("- %s: CER %.1f %%, WER %.1f %% (оценено %d из %d, нет данных %d)\n",
			v, c.Rate*100, w.Rate*100, total-absent, total, absent)
	}
	return missing
}
