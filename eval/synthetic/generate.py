#!/usr/bin/env python3
"""Генератор синтетического eval-набора для «Сверки».

Что делает: рисует страницы-документы на 7 языках (ru, en, de, pl, tr, ar, zh-Hans),
3 таблицы и 2 двуязычные страницы, затем портит их под сканы и фото: наклон, перспектива,
тени, недосвет, смаз, шум, JPEG. Для каждого файла сохраняет эталонный текст и координаты
строк в итоговой картинке (manifest.json).

Всё придумано: названия, номера и суммы вымышлены. Набор синтетический и так помечен.

Запуск:  python3 generate.py [--out DIR] [--seed N]
Нужно:   Pillow с RAQM (арабский), numpy, opencv-python, fontTools и шрифты из FONTS.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import zlib
from pathlib import Path

import cv2
import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

PAGE_W, PAGE_H = 1240, 1754          # A4 при 150 dpi
MARGIN_X = 110
TOP = 150
INK = (28, 27, 25)
PAPER = (251, 250, 246)

LIB = "/usr/share/fonts/truetype/liberation/"
DJV = "/usr/share/fonts/truetype/dejavu/"
NOTO = "/usr/share/fonts/opentype/noto/"
FONTS = {
    "serif": {"regular": (LIB + "LiberationSerif-Regular.ttf", 0), "bold": (LIB + "LiberationSerif-Bold.ttf", 0)},
    "arabic": {"regular": (DJV + "DejaVuSans.ttf", 0), "bold": (DJV + "DejaVuSans-Bold.ttf", 0)},
    "cjk": {"regular": (NOTO + "NotoSansCJK-Regular.ttc", 2), "bold": (NOTO + "NotoSansCJK-Bold.ttc", 2)},
}

# коды движков: Tesseract / Apple Vision
LANG_CODES = {
    "ru": ("rus", "ru-RU"), "en": ("eng", "en-US"), "de": ("deu", "de-DE"),
    "pl": ("pol", "pl-PL"), "tr": ("tur", "tr-TR"), "ar": ("ara", "ar-SA"), "zh": ("chi_sim", "zh-Hans"),
}

SERIAL = "SN-7B0O-1l5I"   # намеренно похожие символы: 7B0O 1l5I

TEXT_DOCS = {
    "ru": dict(langs=["ru"], font="serif", rtl=False, title="АКТ ПРИЁМКИ-ПЕРЕДАЧИ № 2026/10-047", breaks=[0, 2, 3, 6, 10], lines=[
        "г. Екатеринбург, 13 октября 2026 г.",
        "Исполнитель: ООО «Северный Мост», ИНН 6600123450, КПП 660001001.",
        "Заказчик: ИП Орлова Анна Сергеевна, ОГРНИП 304660012345670.",
        "Исполнитель передал, а Заказчик принял следующее оборудование:",
        f"1. Сервер стоечный XR-2200, серийный номер {SERIAL} — 2 шт.",
        "2. Источник бесперебойного питания UP-650, S/N 48201937 — 1 шт.",
        "3. Кабель витая пара, категория 6A, 305 м — 3 бухты.",
        "Общая стоимость — 184 650,00 руб., в том числе НДС 20 % — 30 775,00 руб.",
        "Оплата по счёту № 318 от 02.10.2026 произведена полностью.",
        "Гарантийный срок — 24 месяца с даты подписания акта.",
        "Претензий по количеству и качеству Заказчик не имеет.",
        "Подписи сторон:"]),
    "en": dict(langs=["en"], font="serif", rtl=False, title="DELIVERY ACCEPTANCE CERTIFICATE No. 2026/10-047", breaks=[0, 2, 3, 6, 10], lines=[
        "Manchester, 13 October 2026",
        "Supplier: Northbridge Services Ltd, company no. 01234567, VAT GB 123 4567 89.",
        "Customer: Ms Anna Orlova, sole trader, UTR 12345 67890.",
        "The Supplier has delivered and the Customer has accepted the following equipment:",
        f"1. Rack server XR-2200, serial number {SERIAL} — 2 pcs.",
        "2. Uninterruptible power supply UP-650, S/N 48201937 — 1 pc.",
        "3. Twisted-pair cable, category 6A, 305 m — 3 reels.",
        "The total price is £18,465.00, including VAT at 20% — £3,077.50.",
        "Payment under invoice No. 318 dated 02.10.2026 has been made in full.",
        "The warranty period is 24 months from the date this certificate is signed.",
        "The Customer has no claims regarding quantity or quality.",
        "Signatures of the parties:"]),
    "de": dict(langs=["de"], font="serif", rtl=False, title="ÜBERGABEPROTOKOLL Nr. 2026/10-047", breaks=[0, 2, 3, 6, 10], lines=[
        "Hamburg, 13. Oktober 2026",
        "Auftragnehmer: Nordbrücke Dienstleistungen GmbH, HRB 123456, USt-IdNr. DE123456789.",
        "Auftraggeberin: Anna Orlowa e. K., Steuernummer 12/345/67890.",
        "Der Auftragnehmer übergibt, die Auftraggeberin übernimmt folgende Geräte:",
        f"1. Rack-Server XR-2200, Seriennummer {SERIAL} — 2 Stück.",
        "2. Unterbrechungsfreie Stromversorgung UP-650, S/N 48201937 — 1 Stück.",
        "3. Twisted-Pair-Kabel, Kategorie 6A, 305 m — 3 Rollen.",
        "Der Gesamtpreis beträgt 18.465,00 €, darin 19 % MwSt. — 2.948,19 €.",
        "Die Zahlung gemäß Rechnung Nr. 318 vom 02.10.2026 erfolgte vollständig.",
        "Die Gewährleistungsfrist beträgt 24 Monate ab Unterzeichnung dieses Protokolls.",
        "Die Auftraggeberin hat keine Beanstandungen hinsichtlich Menge und Qualität.",
        "Unterschriften der Parteien:"]),
    "pl": dict(langs=["pl"], font="serif", rtl=False, title="PROTOKÓŁ ODBIORU Nr 2026/10-047", breaks=[0, 2, 3, 6, 10], lines=[
        "Wrocław, 13 października 2026 r.",
        "Wykonawca: Północny Most Usługi Sp. z o.o., NIP 123-456-32-18, KRS 0000123456.",
        "Zamawiająca: Anna Orłowa, jednoosobowa działalność gospodarcza, REGON 123456785.",
        "Wykonawca przekazał, a Zamawiająca odebrała następujący sprzęt:",
        f"1. Serwer rackowy XR-2200, numer seryjny {SERIAL} — 2 szt.",
        "2. Zasilacz awaryjny UP-650, S/N 48201937 — 1 szt.",
        "3. Kabel skrętka, kategoria 6A, 305 m — 3 rolki.",
        "Łączna cena wynosi 18 465,00 zł, w tym VAT 23 % — 3 452,80 zł.",
        "Płatność wg faktury nr 318 z dnia 02.10.2026 została dokonana w całości.",
        "Okres gwarancji wynosi 24 miesiące od daty podpisania protokołu.",
        "Zamawiająca nie wnosi zastrzeżeń co do ilości i jakości.",
        "Podpisy stron:"]),
    "tr": dict(langs=["tr"], font="serif", rtl=False, title="TESLİM TUTANAĞI No: 2026/10-047", breaks=[0, 2, 3, 6, 10], lines=[
        "İstanbul, 13 Ekim 2026",
        "Yüklenici: Kuzey Köprü Hizmetleri A.Ş., Vergi No 1234567890, MERSİS 0123456789012345.",
        "Sipariş veren: Orlova Ticaret, şahıs işletmesi, Vergi No 9876543210.",
        "Yüklenici aşağıdaki cihazları teslim etmiş, sipariş veren teslim almıştır:",
        f"1. Raf tipi sunucu XR-2200, seri numarası {SERIAL} — 2 adet.",
        "2. Kesintisiz güç kaynağı UP-650, S/N 48201937 — 1 adet.",
        "3. Bükümlü çift kablo, kategori 6A, 305 m — 3 makara.",
        "Toplam bedel 184.650,00 TL olup %20 KDV dahildir — 30.775,00 TL.",
        "318 numaralı faturanın (02.10.2026) ödemesi tamamen yapılmıştır.",
        "Garanti süresi, tutanağın imzalandığı tarihten itibaren 24 aydır.",
        "Sipariş veren, miktar ve kalite bakımından itirazda bulunmamaktadır.",
        "Tarafların imzaları:"]),
    "ar": dict(langs=["ar"], font="arabic", rtl=True, title="محضر استلام وتسليم رقم 2026/10-047", breaks=[0, 2, 3, 6, 10], lines=[
        "دبي، 13 أكتوبر 2026",
        "المورّد: شركة الجسر الشمالي للخدمات ذ.م.م، رقم الترخيص 123456.",
        "العميل: السيدة آنا أورلوفا، مؤسسة فردية، الرقم الضريبي 100234567800003.",
        "سلّم المورّد واستلم العميل المعدات التالية:",
        f"1. خادم رفّي XR-2200، الرقم التسلسلي {SERIAL} — عدد 2.",
        "2. مصدر طاقة غير منقطع UP-650، S/N 48201937 — عدد 1.",
        "3. كابل زوج مجدول، الفئة 6A، 305 م — 3 بكرات.",
        "بلغت القيمة الإجمالية 184,650.00 درهماً شاملة ضريبة 5% — 8,792.86 درهماً.",
        "تم السداد بالكامل وفق الفاتورة رقم 318 بتاريخ 02.10.2026.",
        "مدة الضمان 24 شهراً من تاريخ توقيع هذا المحضر.",
        "لا توجد لدى العميل أي ملاحظات بشأن الكمية أو الجودة.",
        "توقيعات الطرفين:"]),
    "zh": dict(langs=["zh"], font="cjk", rtl=False, title="交接验收单 编号 2026/10-047", breaks=[0, 2, 3, 6, 10], lines=[
        "上海，2026年10月13日",
        "服务方：北桥服务有限公司，统一社会信用代码 913100001234567890。",
        "客户方：奥洛娃个体工商户，税号 310123456789012。",
        "服务方已交付、客户方已验收下列设备：",
        f"1. 机架式服务器 XR-2200，序列号 {SERIAL}，2 台。",
        "2. 不间断电源 UP-650，S/N 48201937，1 台。",
        "3. 六类（6A）双绞线缆，305 米，3 箱。",
        "合计金额为人民币 184,650.00 元，其中增值税（13%）21,242.92 元。",
        "发票编号 318（日期 2026-10-02）所列款项已全部付清。",
        "质保期为本验收单签署之日起 24 个月。",
        "客户方对数量和质量均无异议。",
        "双方签字："]),
}

BILINGUAL_DOCS = {
    "ru_en": dict(langs=["ru", "en"], font="serif", rtl=False, title="СПРАВКА / CERTIFICATE № 0457", breaks=[1, 3, 5, 7], lines=[
        "Настоящим подтверждается, что Орлова Анна Сергеевна,",
        "This is to certify that Anna Orlova, born 14.03.1988,",
        "работает в ООО «Северный Мост» с 01.09.2021 в должности",
        "has been employed by Northbridge Services LLC since 01.09.2021 as",
        "руководителя проектов. Ежемесячный доход — 210 000,00 руб.",
        "project manager. Monthly income: RUB 210,000.00.",
        "Справка выдана для предъявления по месту требования.",
        "This certificate is issued for presentation upon request.",
        "Срок действия — 30 дней с даты выдачи (13.10.2026).",
        "Valid for 30 days from the date of issue (13.10.2026)."]),
}

TABLE_DOCS = {
    "table_ru": dict(langs=["ru"], title="СПЕЦИФИКАЦИЯ К АКТУ № 2026/10-047", intro="Оборудование, переданное Заказчику 13.10.2026:",
        header=["№", "Наименование", "Кол-во", "Цена, руб.", "Сумма, руб."],
        rows=[["1", "Сервер стоечный XR-2200", "2", "62 400,00", "124 800,00"],
              ["2", "ИБП UP-650", "1", "18 750,00", "18 750,00"],
              ["3", "Кабель кат. 6A, 305 м", "3", "7 100,00", "21 300,00"],
              ["4", "Шкаф серверный 42U", "1", "15 800,00", "15 800,00"],
              ["5", "Монтаж и настройка", "1", "4 000,00", "4 000,00"]],
        total=["", "Итого", "", "", "184 650,00"]),
    "table_en": dict(langs=["en"], title="SCHEDULE TO CERTIFICATE No. 2026/10-047", intro="Equipment delivered to the Customer on 13.10.2026:",
        header=["No.", "Description", "Qty", "Unit price, £", "Amount, £"],
        rows=[["1", "Rack server XR-2200", "2", "6,240.00", "12,480.00"],
              ["2", "UPS UP-650", "1", "1,875.00", "1,875.00"],
              ["3", "Cable cat. 6A, 305 m", "3", "710.00", "2,130.00"],
              ["4", "Server cabinet 42U", "1", "1,580.00", "1,580.00"],
              ["5", "Installation and setup", "1", "400.00", "400.00"]],
        total=["", "Total", "", "", "18,465.00"]),
    "table_de": dict(langs=["de"], title="ANLAGE ZUM PROTOKOLL Nr. 2026/10-047", intro="Am 13.10.2026 übergebene Geräte:",
        header=["Pos.", "Bezeichnung", "Menge", "Einzelpreis, €", "Betrag, €"],
        rows=[["1", "Rack-Server XR-2200", "2", "6.240,00", "12.480,00"],
              ["2", "USV UP-650", "1", "1.875,00", "1.875,00"],
              ["3", "Netzwerkkabel Kat. 6A, 305 m", "3", "710,00", "2.130,00"],
              ["4", "Serverschrank 42 HE", "1", "1.580,00", "1.580,00"],
              ["5", "Montage und Konfiguration", "1", "400,00", "400,00"]],
        total=["", "Gesamt", "", "", "18.465,00"]),
}
COL_W = [80, 440, 120, 190, 190]     # сумма = PAGE_W - 2 * MARGIN_X
COL_ALIGN = ["c", "l", "c", "r", "r"]

VARIANTS = {
    "clean":             dict(kind="clean"),
    "scan_skew":         dict(kind="scan", angle=(1.5, 3.2), noise=5, blur=0.6, shade=0.05, q=85),
    "photo_perspective": dict(kind="photo", jitter=0.04, rot=(2, 7), shade=0.14, noise=4, blur=1.1, bright=1.0, q=78),
    "lowlight":          dict(kind="photo", jitter=0.035, rot=(1, 5), shade=0.50, noise=11, blur=1.5, bright=0.50, q=60),
    "blur_lowres":       dict(kind="photo", jitter=0.025, rot=(1, 4), shade=0.12, noise=6, blur=0.8, bright=0.95, motion=11, down=0.5, q=50),
}
TEXT_VARIANTS = list(VARIANTS)
SHORT_VARIANTS = ["clean", "photo_perspective"]


def load_font(key: str, weight: str, size: int) -> ImageFont.FreeTypeFont:
    path, idx = FONTS[key][weight]
    return ImageFont.truetype(path, size, index=idx, layout_engine=ImageFont.Layout.RAQM)


def check_glyphs(key: str, texts: list[str]) -> list[str]:
    missing = set()
    for weight in ("regular", "bold"):
        path, idx = FONTS[key][weight]
        cmap = TTFont(path, fontNumber=idx).getBestCmap()
        for t in texts:
            missing |= {c for c in t if not c.isspace() and ord(c) not in cmap}
    return sorted(missing)


def fit_size(texts, key, weight, base, usable, tk):
    size = base
    while size >= 22:
        f = load_font(key, weight, size)
        if max(f.getlength(t, **tk) for t in texts) <= usable:
            return size
        size -= 1
    raise ValueError(f"не помещается в ширину: {texts[:1]}")


def new_page():
    img = Image.new("RGB", (PAGE_W, PAGE_H), PAPER)
    return img, ImageDraw.Draw(img)


def draw_line(draw, xy, text, font, anchor, tk, lines_out):
    box = draw.textbbox(xy, text, font=font, anchor=anchor, **tk)
    draw.text(xy, text, font=font, fill=INK, anchor=anchor, **tk)
    pad = 4
    lines_out.append({"text": text, "box": [box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad]})
    return box


def render_text_page(doc: dict):
    usable = PAGE_W - 2 * MARGIN_X
    tk = {"direction": "rtl", "language": "ar"} if doc["rtl"] else {}
    size = fit_size(doc["lines"], doc["font"], "regular", 34, usable, tk)
    tsize = fit_size([doc["title"]], doc["font"], "bold", 44, usable, tk)
    f, ft = load_font(doc["font"], "regular", size), load_font(doc["font"], "bold", tsize)
    img, draw = new_page()
    lines: list[dict] = []
    y = TOP
    draw_line(draw, (PAGE_W / 2, y), doc["title"], ft, "ma", tk, lines)
    y += int(tsize * 2.3)
    x, anchor = (PAGE_W - MARGIN_X, "ra") if doc["rtl"] else (MARGIN_X, "la")
    step = int(size * 1.85)
    for i, text in enumerate(doc["lines"]):
        draw_line(draw, (x, y), text, f, anchor, tk, lines)
        y += step + (int(size * 0.9) if i in doc["breaks"] else 0)
    y += int(size * 1.6)
    for x0 in (MARGIN_X, PAGE_W - MARGIN_X - 380):       # линии подписей, не текст
        draw.line([(x0, y), (x0 + 380, y)], fill=INK, width=2)
    return np.array(img), lines, [], size


def render_table_page(doc: dict):
    usable = PAGE_W - 2 * MARGIN_X
    size = 30
    for t in [doc["header"]] + doc["rows"] + [doc["total"]]:
        for c, w in zip(t, COL_W):
            while load_font("serif", "bold", size).getlength(c) > w - 24:
                size -= 1
    f, fb = load_font("serif", "regular", size), load_font("serif", "bold", size)
    tsize = fit_size([doc["title"]], "serif", "bold", 44, usable, {})
    ft = load_font("serif", "bold", tsize)
    img, draw = new_page()
    lines: list[dict] = []
    y = TOP
    draw_line(draw, (PAGE_W / 2, y), doc["title"], ft, "ma", {}, lines)
    y += int(tsize * 2.0)
    draw_line(draw, (MARGIN_X, y), doc["intro"], f, "la", {}, lines)
    y += int(size * 2.4)
    row_h = 68
    table = [doc["header"]] + doc["rows"] + [doc["total"]]
    cells = []
    xs = [MARGIN_X]
    for w in COL_W:
        xs.append(xs[-1] + w)
    for r, row in enumerate(table):
        y0, y1 = y + r * row_h, y + (r + 1) * row_h
        if r == 0:
            draw.rectangle([xs[0], y0, xs[-1], y1], fill=(232, 230, 224))
        for c, text in enumerate(row):
            font = fb if r in (0, len(table) - 1) else f
            cx = {"l": xs[c] + 14, "c": (xs[c] + xs[c + 1]) / 2, "r": xs[c + 1] - 14}[COL_ALIGN[c]]
            anchor = {"l": "lm", "c": "mm", "r": "rm"}[COL_ALIGN[c]]
            if text:
                draw.text((cx, (y0 + y1) / 2), text, font=font, fill=INK, anchor=anchor)
            cells.append({"row": r, "col": c, "text": text, "box": [xs[c], y0, xs[c + 1], y1]})
    for r in range(len(table) + 1):
        draw.line([(xs[0], y + r * row_h), (xs[-1], y + r * row_h)], fill=(50, 50, 50), width=2)
    for x in xs:
        draw.line([(x, y), (x, y + len(table) * row_h)], fill=(50, 50, 50), width=2)
    return np.array(img), lines, cells, size


def desk(cw, ch, rng):
    base = np.array(rng.choice([[118, 84, 52], [72, 72, 78], [185, 183, 176]]), np.float32)
    streak = cv2.GaussianBlur(rng.normal(0, 1, (ch, cw)).astype(np.float32), (0, 0), sigmaX=70, sigmaY=2.5)
    streak /= max(float(np.abs(streak).max()), 1e-6)
    fine = rng.normal(0, 1, (ch, cw)).astype(np.float32) * 0.015
    grad = np.linspace(0.92, 1.08, ch, dtype=np.float32)[:, None]
    field = (1 + 0.14 * streak + fine) * grad
    return base[None, None, :] * field[..., None]


def build_variant(page: np.ndarray, p: dict, rng):
    """page RGB uint8 -> (RGB uint8, H 3x3: координаты страницы -> координаты результата)."""
    if p["kind"] == "clean":
        return page.copy(), np.eye(3)       # цифровой эталон: без шума и искажений

    if p["kind"] == "scan":
        m = 100
        cw, ch = PAGE_W + 2 * m, PAGE_H + 2 * m
        ang = rng.uniform(*p["angle"]) * rng.choice([-1, 1])
        M = cv2.getRotationMatrix2D((PAGE_W / 2, PAGE_H / 2), ang, 1.0)
        M[:, 2] += [m, m]
        H = np.vstack([M, [0, 0, 1]])
        warped = cv2.warpAffine(page, M, (cw, ch), flags=cv2.INTER_LINEAR).astype(np.float32)
        mask = cv2.warpAffine(np.full((PAGE_H, PAGE_W), 255, np.uint8), M, (cw, ch)).astype(np.float32)[..., None] / 255
        bg = np.full((ch, cw, 3), (200, 200, 196), np.float32)
        out = warped * mask + bg * (1 - mask)
        bright = 1.0
    else:
        cw, ch = 1500, 2000
        pw = cw * rng.uniform(0.76, 0.82)
        ph = pw * PAGE_H / PAGE_W
        quad = np.array([[-pw / 2, -ph / 2], [pw / 2, -ph / 2], [pw / 2, ph / 2], [-pw / 2, ph / 2]])
        th = np.deg2rad(rng.uniform(*p["rot"]) * rng.choice([-1, 1]))
        R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
        quad = quad @ R.T + rng.uniform(-p["jitter"], p["jitter"], (4, 2)) * np.array([pw, ph])
        quad += [cw / 2 + rng.uniform(-40, 40), ch / 2 + rng.uniform(-50, 50)]
        src = np.float32([[0, 0], [PAGE_W, 0], [PAGE_W, PAGE_H], [0, PAGE_H]])
        H = cv2.getPerspectiveTransform(src, quad.astype(np.float32)).astype(np.float64)
        warped = cv2.warpPerspective(page, H, (cw, ch), flags=cv2.INTER_LINEAR).astype(np.float32)
        mask8 = cv2.warpPerspective(np.full((PAGE_H, PAGE_W), 255, np.uint8), H, (cw, ch))
        mask = mask8.astype(np.float32)[..., None] / 255
        shadow = cv2.warpAffine(mask8, np.float32([[1, 0, 14], [0, 1, 22]]), (cw, ch))
        shadow = cv2.GaussianBlur(shadow, (0, 0), 16).astype(np.float32)[..., None] / 255
        bg = desk(cw, ch, rng) * (1 - 0.5 * shadow)
        out = warped * mask + bg * (1 - mask)
        bright = p["bright"]

    cw, ch = out.shape[1], out.shape[0]
    a = rng.uniform(0, 2 * np.pi)
    yy, xx = np.mgrid[0:ch, 0:cw].astype(np.float32)
    proj = (xx / cw - 0.5) * np.cos(a) + (yy / ch - 0.5) * np.sin(a)
    proj = (proj - proj.min()) / (proj.max() - proj.min())
    out *= (bright * (1 - p["shade"] * proj))[..., None]
    r2 = ((xx / cw - 0.5) ** 2 + (yy / ch - 0.5) ** 2)
    out *= (1 - 0.35 * r2)[..., None]
    if p.get("motion"):
        L, phi = p["motion"], rng.uniform(0, np.pi)
        k = np.zeros((L, L), np.float32)
        c = L // 2
        cv2.line(k, (int(c - c * np.cos(phi)), int(c - c * np.sin(phi))), (int(c + c * np.cos(phi)), int(c + c * np.sin(phi))), 1, 1)
        out = cv2.filter2D(out, -1, k / k.sum())
    out = cv2.GaussianBlur(out, (0, 0), p["blur"])
    if p.get("down"):
        small = cv2.resize(out, None, fx=p["down"], fy=p["down"], interpolation=cv2.INTER_AREA)
        out = cv2.resize(small, (cw, ch), interpolation=cv2.INTER_LINEAR)
    out += rng.normal(0, p["noise"], out.shape)
    return np.clip(out, 0, 255).astype(np.uint8), H


def to_polygon(box, H):
    x0, y0, x1, y1 = box
    pts = np.float32([[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]])
    return [[int(round(x)), int(round(y))] for x, y in cv2.perspectiveTransform(pts, H)[0]]


def save(img_rgb: np.ndarray, path: Path, quality: int | None):
    bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    params = [cv2.IMWRITE_JPEG_QUALITY, quality] if quality else []
    if not cv2.imwrite(str(path), bgr, params):
        raise OSError(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent))
    ap.add_argument("--seed", type=int, default=20261013)
    ap.add_argument("--only", help="id документа, например ru")
    args = ap.parse_args()
    out = Path(args.out)
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "ground_truth").mkdir(parents=True, exist_ok=True)

    jobs = [(k, d, "text", TEXT_VARIANTS) for k, d in TEXT_DOCS.items()]
    jobs += [(k, d, "bilingual", SHORT_VARIANTS) for k, d in BILINGUAL_DOCS.items()]
    jobs += [(k, d, "table", SHORT_VARIANTS) for k, d in TABLE_DOCS.items()]
    manifest = []
    for doc_id, doc, kind, variants in jobs:
        if args.only and doc_id != args.only:
            continue
        texts = ([doc["title"]] + doc["lines"]) if kind != "table" else \
            [doc["title"], doc["intro"]] + doc["header"] + [c for r in doc["rows"] for c in r] + doc["total"]
        missing = check_glyphs(doc.get("font", "serif"), texts)
        if missing:
            print(f"[{doc_id}] нет глифов в шрифте: {missing}", file=sys.stderr)
            return 1
        page, lines, cells, font_px = (render_table_page(doc) if kind == "table" else render_text_page(doc))
        gt_name = f"ground_truth/{doc_id}.csv" if kind == "table" else f"ground_truth/{doc_id}.txt"
        if kind == "table":
            with open(out / gt_name, "w", newline="", encoding="utf-8") as fh:
                w = csv.writer(fh)
                w.writerow(doc["header"]); w.writerows(doc["rows"]); w.writerow(doc["total"])
        else:
            (out / gt_name).write_text("\n".join(l["text"] for l in lines) + "\n", encoding="utf-8")
        for variant in variants:
            p = VARIANTS[variant]
            rng = np.random.default_rng(zlib.crc32(f"{doc_id}:{variant}".encode()) ^ args.seed)
            img, H = build_variant(page, p, rng)
            ext = "png" if variant == "clean" else "jpg"
            rel = f"images/{doc_id}_{variant}.{ext}"
            save(img, out / rel, None if variant == "clean" else p["q"])
            codes = [LANG_CODES[l] for l in doc["langs"]]
            manifest.append({
                "file": rel, "doc": doc_id, "kind": kind, "variant": variant, "synthetic": True,
                "languages": doc["langs"], "tesseract_langs": "+".join(c[0] for c in codes),
                "vision_langs": [c[1] for c in codes], "rtl": bool(doc.get("rtl")),
                "size_px": [img.shape[1], img.shape[0]], "font_px": font_px, "ground_truth": gt_name,
                "lines": [{"text": l["text"], "polygon": to_polygon(l["box"], H)} for l in lines],
                **({"cells": [{**{k: v for k, v in c.items() if k != "box"}, "polygon": to_polygon(c["box"], H)} for c in cells]} if cells else {}),
            })
            print("ok", rel)
    (out / "manifest.json").write_text(json.dumps({
        "name": "Сверка: синтетический eval-набор", "synthetic": True, "generator": "generate.py",
        "seed": args.seed, "page_px": [PAGE_W, PAGE_H], "images": manifest}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"всего изображений: {len(manifest)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
