#!/bin/sh
# Скачивает модели tessdata_best для офлайн-распознавания на Android в assets модуля
# и проверяет их sha256 по backend/tessdata.sha256 (тот же коммит, что и на сервере).
# Запуск: npm run fetch:tessdata [-- rus eng pol]
set -eu
root="$(cd "$(dirname "$0")/../.." && pwd)"
commit=e12c65a915945e4c28e237a9b52bc4a8f39a0cec
sums="$root/backend/tessdata.sha256"
target="$root/app/modules/sverka-ocr/android/src/main/assets/tessdata"
langs="${*:-rus eng pol}"

mkdir -p "$target"
for l in $langs; do
  file="$target/$l.traineddata"
  if [ ! -f "$file" ]; then
    curl -fsSL -o "$file.part" "https://github.com/tesseract-ocr/tessdata_best/raw/$commit/$l.traineddata"
    mv "$file.part" "$file"
  fi
  expected="$(grep " $l.traineddata\$" "$sums" | cut -d' ' -f1)"
  [ -n "$expected" ] || { echo "no checksum for $l in $sums" >&2; exit 1; }
  echo "$expected  $file" | shasum -a 256 -c -
done
