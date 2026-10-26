# Как запустить

Я собираю всё на Mac с Apple Silicon. Раздел «один раз» — подготовка, остальное — каждый запуск.

## Что нужно (один раз)
1. Xcode 26 из App Store, затем в терминале:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   xcodebuild -downloadPlatform iOS
   ```
2. Node 24, CocoaPods (`brew install cocoapods`) и watchman (`brew install watchman`). CocoaPods на Ruby 4 падает без UTF-8, поэтому перед `pod install` нужно `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
3. Для Android: JDK 17 (`brew install openjdk@17`) и Android SDK 36 с эмулятором (через Android Studio или command-line tools), NDK 27.1.
4. Docker — для сервера.

## iOS: симулятор или iPhone
```bash
cd app
npm install
npx expo run:ios
```
Первая сборка ставит pods и собирает нативный модуль `sverka-ocr` (Swift + Apple Vision); это несколько минут. На симуляторе нет камеры: снимок выбирается кнопкой «Из фото» (картинки из `eval/synthetic/images` и `eval/camera/images` можно перетащить в окно симулятора). Для iPhone: подключить телефон кабелем и запустить `npx expo run:ios --device`; в Xcode выбрать свою команду (Signing & Capabilities).

Открыть проект в Xcode, если сборка из терминала упала: `open ios/Sverka.xcworkspace`.

## Android: эмулятор
```bash
cd app
npm run fetch:tessdata   # модели rus, eng, pol (около 42 МБ), проверка sha256
npx expo run:android
```

## Сервер
Для проверки с симулятора на этом же Mac (нужен `brew install tesseract` и модели в `.tessdata/`):
```bash
cd backend
export SVERKA_TOKEN=$(openssl rand -hex 32)
echo $SVERKA_TOKEN
make run
```
В приложении: «Сервер» → адрес `http://localhost:8080` и ключ, который напечатала `echo`. Адрес `http://` приложение разрешает только для `localhost` и эмулятора Android (`10.0.2.2`); для настоящего сервера нужен `https://`.

На сервере с доменом:
```bash
cp .env.example .env     # SVERKA_TOKEN=$(openssl rand -hex 32), SVERKA_DOMAIN=ваш домен
docker compose up --build -d
```
Caddy сам выпустит сертификат для домена. Порт 8080 сервиса `sverka` наружу не публикуется: за Caddy сервер доверяет `X-Forwarded-For`.

## Проверки без телефона
```bash
cd app && npm test && npm run typecheck && npm run typecheck:logic && npm run lint
cd backend && make test && make lint
```

`npm run lint` запускает ESLint (правила Expo, стили React Native, границы слоёв) и knip (неиспользуемые файлы, экспорты и зависимости). Stylelint не подключён: в React Native стили задаются объектами в TypeScript, CSS-файлов в приложении нет.

## e2e

Сценарии Maestro лежат в `app/e2e`:

```bash
cd app
e2e/run-ios.sh <путь к Sverka.app>                       # main.yaml: фото → текст → сверка → PDF
MEDIA=../eval/camera/images/typos_ru_en_photo.jpg e2e/run-ios.sh <Sverka.app> e2e/typos.yaml
e2e/run-android.sh android/app/build/outputs/apk/release/app-universal-release.apk
```

Для `server.yaml` нужны `SERVER_URL`, `SVERKA_TOKEN` и `CADDY_ROOT_CERT` (корневой сертификат локального Caddy).

## Устройство кода приложения
`app/src` разложен по слоям Feature-Sliced Design, снизу вверх; слой импортирует только нижние слои, а срезы features, widgets и pages не импортируют друг друга (проверяет ESLint):
- `shared` — тема, кнопки и поля, склонения;
- `entities` — документ и его хранение, строка и правила сверки, языки;
- `features` — распознавание, съёмка, отправка на сервер, поиск, экспорт, словарь правок;
- `widgets` — карточка текста, карточка строки на сверке, выбор языков, верхняя панель;
- `pages` — экраны;
- `app` — запуск, навигация, загрузка данных.

