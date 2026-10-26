#!/usr/bin/env bash
# Прогоняет синтетический набор через Apple Vision (macOS) и Tesseract CLI на этом Mac.
# Результаты: eval/results/raw/{vision-macos,tesseract-mac}/<имя>.{json,tsv,txt}
# Ошибки отдельных картинок пишутся в eval/results/raw/errors.log, прогон продолжается.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
set_dir="$root/eval/synthetic"
out="$root/eval/results/raw"
tessdata="${TESSDATA_DIR:-$root/.tessdata}"
vision="$root/eval/.bin/vision-ocr"
vision_src="$root/eval/tools/vision-ocr/main.swift"
log="$out/errors.log"

if [[ ! -x "$vision" || "$vision_src" -nt "$vision" ]]; then
    mkdir -p "$(dirname "$vision")"
    swiftc -O "$vision_src" -o "$vision"
fi
command -v tesseract >/dev/null || { echo "tesseract not found: brew install tesseract" >&2; exit 1; }

rm -rf "$out/vision-macos" "$out/tesseract-mac"
mkdir -p "$out/vision-macos" "$out/tesseract-mac"
: > "$log"

failed=0
while IFS='|' read -r file tlangs vlangs; do
    name="$(basename "${file%.*}")"
    tmp="$out/vision-macos/$name.json.tmp"
    # Vision on macOS occasionally fails with "Foundation._GenericObjCError error 0"; one retry, logged.
    if "$vision" "$set_dir/$file" "$vlangs" > "$tmp" 2>>"$log" ||
        { echo "vision retry: $name" >> "$log"; "$vision" "$set_dir/$file" "$vlangs" > "$tmp" 2>>"$log"; }; then
        mv "$tmp" "$out/vision-macos/$name.json"
    else
        rm -f "$tmp"; echo "vision failed: $name" >> "$log"; failed=$((failed + 1))
    fi
    if ! tesseract "$set_dir/$file" "$out/tesseract-mac/$name" -l "$tlangs" \
        --tessdata-dir "$tessdata" --psm 3 -c tessedit_create_txt=1 -c tessedit_create_tsv=1 2>>"$log" >/dev/null; then
        rm -f "$out/tesseract-mac/$name".*; echo "tesseract failed: $name" >> "$log"; failed=$((failed + 1))
    fi
    echo "$name"
done < <(python3 -c '
import json, sys
for im in json.load(open(sys.argv[1]))["images"]:
    t, v = im["tesseract_langs"], ",".join(im["vision_langs"])
    assert t and v, im["file"]
    print(im["file"], t, v, sep="|")
' "$set_dir/manifest.json")

echo "failed runs: $failed (details in $log)"
