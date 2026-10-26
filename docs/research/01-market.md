# Разведка рынка: мобильное распознавание документов

Дата сбора: 13.10.2026. Всё, что ниже, взято со страниц по ссылкам. Пометка «не подтверждено» значит, что источник этого не говорит.

## ABBYY FineReader (мобильный FineScanner и десктоп)
- Мобильное iOS-приложение: офлайн-распознавание даёт только TXT; полноценное распознавание (183 языка, 4 формата: DOCX, XLSX, TXT, searchable PDF) работает онлайн. [App Store](https://apps.apple.com/us/app/finereader-pdf-scanner-ocr/id534203582), [pdf.abbyy.com](https://pdf.abbyy.com/finereader-ios-android/)
- Цена (iOS, США): Premium $7.99/мес или $29.99/год; бесплатно одно сканирование в день после пробных. [App Store](https://apps.apple.com/us/app/finereader-pdf-scanner-ocr/id534203582)
- Android-версия FineReader PDF Mobile и TextGrabber сняты с поддержки. [pdf.abbyy.com](https://pdf.abbyy.com/finereader-ios-android/)
- Ярлыки приватности App Store: «пользовательский контент» в данных, используемых для трекинга. [App Store](https://apps.apple.com/us/app/finereader-pdf-scanner-ocr/id534203582)
- Десктоп FineReader PDF: от 69 €/год (Mac) до 165 €/год (Corporate, Windows). [pdf.abbyy.com/pricing](https://pdf.abbyy.com/pricing/)
- Важно для нас: в десктопном FineReader 16 есть проверка: неуверенные символы подсвечиваются, диалог Verification ведёт по ним, картинка участка показывается рядом. [help.abbyy.com](https://help.abbyy.com/en-us/finereader/16/user_guide/checkingtext/) В мобильном приложении такой функции на странице App Store нет.

## Adobe Scan / Acrobat
- OCR на 18 языках (есть русский, нет арабского, иврита, тайского). [Adobe Scan settings](https://www.adobe.com/devnet-docs/adobescan/ios/en/settings.html)
- Лимит OCR: бесплатно до 25 страниц в документе (в App Store указано «с 5 до 100»), платно до 100. [subscriptions](https://www.adobe.com/devnet-docs/adobescan/ios/en/subscriptions.html), [App Store](https://apps.apple.com/us/app/adobe-scan-pdf-ocr-scanner/id1199564834)
- Для OCR нужны сеть и подключение к облачному хранилищу Adobe. Если язык выбран неверно, «OCR не даёт результата»; документы на нескольких языках распознаются хуже. [troubleshooting](https://www.adobe.com/devnet-docs/adobescan/ios/en/troubleshooting.html)
- Цена: Plus $4.99/мес или $19.99/год, Premium $9.99–14.99/мес. [App Store](https://apps.apple.com/us/app/adobe-scan-pdf-ocr-scanner/id1199564834)
- Жалоба: двойное списание после отмены пробного периода (март 2026). [community.adobe.com](https://community.adobe.com/questions-6/charged-for-2-subscriptions-on-a-7-day-free-trial-1554478)
- Жалобы на русский OCR: [1](https://community.adobe.com/t5/acrobat-discussions/i-want-to-perform-ocr-on-a-russian-cyrillic-based-pdf/m-p/8857358), [2](https://community.adobe.com/t5/adobe-acrobat-online-discussions/i-need-ocr-in-russian/m-p/11962096); на смешанные языки: [3](https://community.adobe.com/t5/adobe-scan-discussions/multi-lingual-document-ocr/td-p/9144913).

## Google Lens / Google Drive
- Сканер Drive на Android сохраняет PDF или JPG в Drive, по словам Google, «searchable PDF»; как работает распознавание и где, на странице не сказано. [support.google.com](https://support.google.com/drive/answer/3145835?hl=en)
- История визуального поиска Lens по умолчанию выключена, при включении хранится по настройкам автоудаления аккаунта. [9to5google](https://9to5google.com/2024/03/07/google-lens-visual-search-history/)
- Уверенность по словам пользователю не показывается: не подтверждено ни в одну сторону, источника не нашёл.

## Microsoft Lens
- Закрыт: с 9.02.2026 удалён из магазинов, с 9.03.2026 перестал сканировать. Замена: сканер в OneDrive, который сохраняет только в облако OneDrive. [support.microsoft.com](https://support.microsoft.com/en-gb/topic/retirement-of-microsoft-lens-fc965de7-499d-4d38-aeae-f6e48271652d)
- Вывод: аудитория бесплатного сканера без подписки сейчас ищет замену.

## CamScanner
- 2019: в бесплатной Android-версии нашли троян-дроппер в рекламной библиотеке, приложение удаляли из Google Play; на тот момент 100+ млн установок. [securityaffairs](https://securityaffairs.com/90454/malware/camscanner-app-malware.html)
- Политика: загруженные файлы хранятся «пока вы их не удалите»; распознавание (OCR) упомянуто как обработка загруженного контента. [privacy](https://v3.camscanner.com/iOS/privacy)
- Цена (iOS, США): $9.99/мес, $59.99/год. [App Store](https://apps.apple.com/us/app/camscanner-pdf-scanner-app/id388627783)
- Жалобы: списания во время пробного периода, невозможность отменить подписку, водяные знаки после оплаты, OCR стал платным, потеря документов после обновления. [sikayetvar](https://www.sikayetvar.com/en/camscanner-us)

## Apple Live Text / Vision
- Live Text обрабатывает всё на устройстве. [eclecticlight](https://eclecticlight.co/2022/03/29/live-text-visual-look-up-face-recognition-ml-and-privacy/)
- Vision `RecognizeDocumentsRequest` (iOS 26): таблицы (ячейки с диапазонами строк/столбцов), списки, абзацы, всё на устройстве; 26 языков; доступа на уровне слов нет для китайского, японского, корейского и тайского. [WWDC25 #272](https://developer.apple.com/videos/play/wwdc2025/272/)
- Live Text как функция iOS сам по себе не делает searchable PDF и таблицы: это возможность системы, не приложение для документов.

## Обёртки над Tesseract и PaddleOCR
- «OCR» (F-Droid): Tesseract 5, 120+ языков, полностью офлайн, Apache-2.0, релиз 6.1 от 10.08.2026. [F-Droid](https://f-droid.org/en/packages/io.github.subhamtyagi.ocr/)
- Ente: перенесли PaddleOCR v5 на ONNX Runtime для офлайн-OCR на Android, Tesseract-порты называют устаревшими и неточными. [ente.com](https://ente.com/blog/ocr/)
- Prizmo Go: пример гибрида, облачный OCR (Microsoft) можно отключить и работать локально. [macstories](https://www.macstories.net/reviews/prizmo-go-review-smarter-ocr-with-the-iphones-camera/)

## Что из этого следует
1. Проверка неуверенных слов рядом с картинкой участка есть в десктопном FineReader за 69–165 €/год, но не в мобильных приложениях из списка (по страницам магазинов).
2. Лидеры отправляют документ в облако для полного OCR (ABBYY онлайн, Adobe требует облако) и хранят контент до удаления (CamScanner).
3. Языковое покрытие у мобильных лидеров неровное: Adobe 18 языков, ML Kit (основа многих Android-приложений) не поддерживает кириллицу (см. 02-engines.md).
4. Microsoft Lens закрыт в 2026, его пользователи остались без бесплатного сканера.
