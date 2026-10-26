#!/usr/bin/env bash
# Читает снимки из images/ обоими движками на этом Mac (Vision, как на iOS, и Tesseract
# tessdata_best, как на Android) и печатает CER по каждому снимку. Синтетика, Mac, не телефон.
# Запуск: eval/camera/check.sh (после swift render.swift images)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
vision="$root/eval/.bin/vision-ocr"
[[ -x "$vision" ]] || swiftc -O "$root/eval/tools/vision-ocr/main.swift" -o "$vision"
langs() {
  case "$1" in
    sign_ru*|note_ru*) echo "rus|ru-RU" ;;
    screen_en*) echo "eng|en-US" ;;
    book_pl*) echo "pol|pl-PL" ;;
    doc_ru_en*|typos_ru_en*) echo "rus+eng|ru-RU,en-US" ;;
  esac
}
printf '| снимок | Vision CER | Tesseract CER |\n|---|---|---|\n'
for img in "$here"/images/*.png "$here"/images/*_photo.jpg; do
  name="$(basename "${img%.*}")"; base="${name%_photo}"
  IFS='|' read -r tl vl <<<"$(langs "$name")"
  v="$("$vision" "$img" "$vl" | python3 -c 'import json,sys; print("\n".join(l["text"] for l in json.load(sys.stdin)["lines"]))')"
  t="$(tesseract "$img" - -l "$tl" --tessdata-dir "$root/.tessdata" --psm 3 2>/dev/null)"
  python3 - "$here/images/$base.txt" "$name" "$v" "$t" <<'PY'
import sys, unicodedata
def norm(s): return "\n".join(" ".join(l.split()) for l in unicodedata.normalize("NFC", s).splitlines() if l.strip())
def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]
ref = norm(open(sys.argv[1]).read())
cer = lambda hyp: f"{100 * lev(norm(hyp), ref) / len(ref):.1f} %"
print(f"| {sys.argv[2]} | {cer(sys.argv[3])} | {cer(sys.argv[4])} |")
PY
done
