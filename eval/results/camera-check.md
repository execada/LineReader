Синтетика: 5 снимков, нарисованных `eval/camera/render.swift`, чистые и «как с телефона». Mac, не телефон: Vision на macOS и Tesseract 5.5.3 tessdata_best.

| снимок | Vision CER | Tesseract CER |
|---|---|---|
| book_pl | 0.0 % | 0.8 % |
| doc_ru_en | 0.0 % | 0.0 % |
| note_ru | 0.0 % | 0.0 % |
| screen_en | 2.4 % | 4.9 % |
| sign_ru | 0.0 % | 0.0 % |
| book_pl_photo | 0.8 % | 4.9 % |
| doc_ru_en_photo | 0.0 % | 5.1 % |
| note_ru_photo | 0.0 % | 0.0 % |
| screen_en_photo | 2.4 % | 6.1 % |
| sign_ru_photo | 0.0 % | 0.0 % |

Ошибки: на экране код `0O1l-5S2Z` Vision прочитал как `0011-5S2Z` с уверенностью 1,0 (строку ловит правило «цифры рядом с похожими буквами»); Tesseract на фото справки потерял точку в дате и букву в CERTIFICATE.
