# Движки и библиотеки (search-first)

Дата проверки: 13.10.2026. Звёзды, даты и лицензии взяты через `gh api repos/...`, версии пакетов через pub.dev и npm. Строка «проверено локально» означает, что я запускал это на этом Mac (macOS 26.6.2, M4).

## На устройстве

| Движок | Лицензия, живость | Языки | Уверенность и рамки | Вывод |
|---|---|---|---|---|
| Apple Vision `VNRecognizeTextRequest` | системный, iOS 13+ | режим `.accurate`: 30 локалей, проверено локально: en, fr, it, de, es, pt-BR, zh-Hans/Hant, yue, ko, ja, **ru**, th, vi, ar, ars, tr, id, cs, da, nl, no/nn/nb, ms, pl, ro, sv. Режим `.fast`: 6 | `confidence` 0…1 у каждого кандидата строки ([docs](https://developer.apple.com/tutorials/data/documentation/vision/vnrecognizedtext/confidence.json)), до N кандидатов на строку; рамку слова даёт `boundingBox(for:)` | основа офлайн-режима на iOS |
| Apple Vision `RecognizeDocumentsRequest` | системный, iOS 26+ (проверено по JSON документации) | 26 языков; для CJK и тайского нет доступа к словам ([WWDC25](https://developer.apple.com/videos/play/wwdc2025/272/)) | таблицы с ячейками и объединениями, абзацы, списки; про уверенность на странице не сказано | таблицы офлайн на iOS 26 |
| VisionKit `VNDocumentCameraViewController` | системный | — | поиск краёв, выравнивание перспективы | камера на iOS без своей реализации |
| Google ML Kit Text Recognition v2 | бесплатно, Flutter-плагин 0.17.1 от 17.08.2026 | латиница 31 + 15 экспериментальных, китайский, деванагари, японский, корейский. **Кириллицы нет** (русского нет в списке) ([languages](https://developers.google.com/ml-kit/vision/text-recognition/v2/languages)) | уверенность у строки, элемента, символа ([v2](https://developers.google.com/ml-kit/vision/text-recognition/v2)) | для Android без кириллицы не годится как единственный движок |
| ML Kit Document Scanner | только Android, через Google Play services, на устройстве ([docs](https://developers.google.com/ml-kit/vision/doc-scanner)) | — | — | камера на Android |
| Tesseract 5.5.3 | Apache-2.0, релиз 24.07.2026, 76.9k звёзд | 126 моделей в tessdata_fast, 125 в tessdata_best (посчитано по репозиториям), включая rus, bel, kaz, heb, ara, fas, hin | уверенность и рамки на уровне слова и символа | широкие языки; на iOS обёртка SwiftyTesseract **заархивирована** (2022), на Android Tesseract4Android 4.9.0 жив |
| PaddleOCR 3.7 (PP-OCRv6) | Apache-2.0, релиз 11.06.2026, 91k звёзд | PP-OCRv6: одна модель на 50 языков (китайский, английский, японский + 46 латинских); всего «100+» в README | рамки и уверенность строки | сильный, но кириллица не в единой модели v6 (не подтверждено, есть ли отдельная) |
| RapidOCR 3.10 (ONNX) | Apache-2.0, релиз 08.10.2026 | модели PaddleOCR | то же | удобный путь к PaddleOCR без Paddle |
| paddle_ocr_native (Flutter) | 0.1.1 от 29.07.2026, молодой | PP-OCRv6 | — | рискованно для недели |

## Go-бэкенд

| Библиотека | Лицензия, живость | Что даёт | Вывод |
|---|---|---|---|
| [gosseract](https://github.com/otiai10/gosseract) | MIT, последний коммит 16.01.2026, релиз v2.4.1 (2023) | Tesseract из Go через cgo; `GetBoundingBoxes(level)` с `Confidence` на слове (проверено по `client.go`) | основной движок онлайн-режима: 125 языков tessdata_best |
| [onnxruntime_go](https://github.com/yalue/onnxruntime_go) | MIT, коммит 04.09.2026 | запуск ONNX-моделей (RapidOCR/PaddleOCR) из Go | вариант второго движка; пред- и постобработку детектора придётся писать самому, на неделю рискованно |
| [docTR](https://github.com/mindee/doctr) | Apache-2.0, v1.1.0 от 21.08.2026 | Python | только как Python-сайдкар, на неделю не берём |
| [Surya](https://github.com/datalab-to/surya) | код Apache-2.0, **веса Open RAIL-M с ограничением** для компаний >5 млн $ | Python | не берём из-за лицензии весов |
| [img2table](https://github.com/xavctn/img2table) | MIT, 2.0.0 от 10.05.2026 | таблицы по линиям, Python | вне недели |
| [Table Transformer](https://github.com/microsoft/table-transformer) | MIT, **заархивирован** | — | нет |
| [OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF) | MPL-2.0, v17.13.0 от 28.09.2026 | searchable PDF, Python | как эталон, не как зависимость |
| [go-pdf/fpdf](https://github.com/go-pdf/fpdf) | MIT, **заархивирован** | `SetTextRenderingMode(3)` невидимый текст, `AddUTF8Font` | работает, но архив |
| [signintech/gopdf](https://github.com/signintech/gopdf) | MIT, коммит 10.10.2026 | TTF-шрифты; режима невидимого текста в коде не нашёл | можно писать оператор `3 Tr` вручную, не подтверждено |
| [pdfcpu](https://github.com/pdfcpu/pdfcpu) | Apache-2.0, v0.16.2 от 11.10.2026 | render mode только 0–2 (проверено в `stamp.go`) | для невидимого слоя не годится |
| unidoc/unipdf | коммерческая лицензия | — | нет |

## Searchable PDF на iOS
Невидимый текстовый слой можно рисовать через Core Graphics (`CGContext.setTextDrawingMode(.invisible)`) поверх изображения страницы в PDF-контексте. Это стандартный API, но я его на этом Mac не запускал: не подтверждено до реализации.

## Выбор платформы
- Xcode и Android SDK на Mac сейчас не установлены. Для любой мобильной сборки один из них придётся поставить.
- На iOS системный Vision даёт офлайн 30 локалей с кириллицей, таблицы (iOS 26), камеру с выравниванием и PDF без сторонних зависимостей. На Android ML Kit не знает кириллицы, а Tesseract на телефоне медленнее и менее точен на фото (по словам [Ente](https://ente.com/blog/ocr/)).
- Кроссплатформа (Flutter, React Native) здесь не экономит: офлайн-движки разные на двух ОС, а плагин для Apple Vision во Flutter (`apple_vision_recognize_text` 0.1.0, 20 звёзд) молодой.
- Вывод: **нативный iOS (Swift, SwiftUI)**, Android вне недели.
