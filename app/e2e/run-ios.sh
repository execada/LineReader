#!/bin/sh
# e2e на чистом симуляторе iOS: создаёт устройство «Sverka e2e», ставит собранное
# приложение, кладёт в фото один снимок из eval-набора и гоняет сценарии Maestro.
# Использование: e2e/run-ios.sh <путь к Sverka.app> [сценарий.yaml ...]
# MEDIA — другой снимок для фото симулятора (typos.yaml: eval/camera/images/typos_ru_en_photo.jpg).
# Для server.yaml нужны SERVER_URL и SVERKA_TOKEN в окружении и, для локального
# Caddy, CADDY_ROOT_CERT — его корневой сертификат. Ключ для e2e — только цифры:
# в защищённом поле на симуляторе с русской раскладкой XCTest теряет латинские
# буквы (из ключа bf44… доходило 4484…), это особенность ввода в тесте, не приложения.
#   SVERKA_TOKEN=$(LC_ALL=C tr -dc 0-9 </dev/urandom | head -c 40)
set -eu
# The XCTest driver can take minutes to start on a busy Mac.
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-300000}"
app="$1"; shift
root="$(cd "$(dirname "$0")/../.." && pwd)"
name="Sverka e2e"
udid="$(xcrun simctl list devices | awk -v n="$name" -F '[()]' '$0 ~ n {print $2; exit}')"
if [ -z "$udid" ]; then
  udid="$(xcrun simctl create "$name" "iPhone 18 Pro")"
else
  xcrun simctl shutdown "$udid" 2>/dev/null || true
  xcrun simctl erase "$udid"
fi
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b >/dev/null
xcrun simctl install "$udid" "$app"
xcrun simctl addmedia "$udid" "${MEDIA:-$root/eval/synthetic/images/ru_photo_perspective.jpg}"
xcrun simctl privacy "$udid" grant photos app.sverka.mvp
xcrun simctl privacy "$udid" grant camera app.sverka.mvp
if [ -n "${CADDY_ROOT_CERT:-}" ]; then
  xcrun simctl keychain "$udid" add-root-cert "$CADDY_ROOT_CERT"
fi
flows="${*:-$root/app/e2e/main.yaml}"
for flow in $flows; do
  maestro --device "$udid" test \
    ${SERVER_URL:+-e SERVER_URL="$SERVER_URL"} ${SVERKA_TOKEN:+-e SVERKA_TOKEN="$SVERKA_TOKEN"} "$flow"
done
