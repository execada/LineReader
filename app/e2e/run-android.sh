#!/bin/sh
# e2e на Android-эмуляторе: ставит собранный APK начисто, кладёт в галерею один снимок
# и гоняет сценарии Maestro. Эмулятор должен быть запущен (emulator -avd <имя> -gpu host).
# Использование: e2e/run-android.sh <путь к app-release.apk> [сценарий.yaml ...]
# MEDIA — другой снимок для галереи (по умолчанию eval/camera/images/note_ru_photo.jpg).
set -eu
apk="$1"; shift
root="$(cd "$(dirname "$0")/../.." && pwd)"
adb="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}/platform-tools/adb"
media="${MEDIA:-$root/eval/camera/images/note_ru_photo.jpg}"
"$adb" wait-for-device
"$adb" install -r "$apk" >/dev/null
"$adb" shell pm clear app.sverka.mvp >/dev/null
"$adb" shell pm grant app.sverka.mvp android.permission.CAMERA
"$adb" shell 'rm -f /sdcard/Pictures/sverka-e2e-*'
"$adb" push "$media" "/sdcard/Pictures/sverka-e2e-$(basename "$media")" >/dev/null
"$adb" shell content call --method scan_volume --uri content://media --arg external_primary >/dev/null
flows="${*:-$root/app/e2e/android.yaml}"
for flow in $flows; do
  maestro --device emulator-5554 test "$flow"
done
