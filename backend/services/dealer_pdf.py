"""Minimal commercial-offer PDF generator for dealer orders.

The main sauna PDF pipeline (`routes/sauna.py::generate_sauna_pdf_bytes`) is built
around the full SaunaPDFRequest structure (selections, quantities, variant tables,
images, plus-only categories, …). Dealer orders use a simpler `options` list, so
we generate a standalone one-page commercial offer that only depends on fields the
dealer actually provided.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)

# --- Register a Unicode-capable font once per process -----------------------
_FONT_REGISTERED = False
_FONT_NAME = "Helvetica"  # reportlab default fallback


def _ensure_font() -> str:
    """Register DejaVu Sans if available — provides full Cyrillic/Polish support."""
    global _FONT_REGISTERED, _FONT_NAME
    if _FONT_REGISTERED:
        return _FONT_NAME
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ):
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", path))
            _FONT_NAME = "DejaVuSans"
            break
        except Exception:
            continue
    _FONT_REGISTERED = True
    return _FONT_NAME


def _fmt_pln(value) -> str:
    try:
        n = int(round(float(value or 0)))
    except Exception:
        n = 0
    return f"{n:,}".replace(",", " ") + " PLN"


def _fmt_date(raw: str | None) -> str:
    if not raw:
        raw = datetime.now(timezone.utc).isoformat()
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y")
    except Exception:
        return str(raw)[:10]


def generate_dealer_offer_pdf(order: dict, dealer: dict) -> bytes:
    """Render a 1-page commercial offer for an order submitted by a dealer."""
    font = _ensure_font()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Offer-{order.get('id','')}",
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle("title", parent=styles["Heading1"], fontName=font, fontSize=20, leading=24, textColor=colors.HexColor("#111827"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName=font, fontSize=13, leading=16, textColor=colors.HexColor("#374151"))
    body = ParagraphStyle("body", parent=styles["Normal"], fontName=font, fontSize=10, leading=14, textColor=colors.HexColor("#1f2937"))
    muted = ParagraphStyle("muted", parent=body, fontSize=9, textColor=colors.HexColor("#6b7280"))
    right = ParagraphStyle("right", parent=body, alignment=2)
    right_muted = ParagraphStyle("right_muted", parent=muted, alignment=2)

    story = []

    # ----- Header: dealer branding (left) + offer title (right) -----
    dealer_block = [
        Paragraph(f"<b>{dealer.get('name') or dealer.get('username', '—')}</b>", body),
    ]
    contacts = []
    if dealer.get("phone"):
        contacts.append(str(dealer["phone"]))
    if dealer.get("email"):
        contacts.append(str(dealer["email"]))
    if contacts:
        dealer_block.append(Paragraph(" · ".join(contacts), muted))

    offer_block = [
        Paragraph("OFERTA HANDLOWA", title),
        Paragraph(f"№ <b>{order.get('id', '')}</b>", right),
        Paragraph(f"Data: {_fmt_date(order.get('createdAt'))}", right_muted),
    ]

    header = Table(
        [[dealer_block, offer_block]],
        colWidths=[90 * mm, 84 * mm],
        style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]),
    )
    story.append(header)
    story.append(Spacer(1, 8 * mm))

    # ----- Customer block -----
    story.append(Paragraph("Klient", h2))
    client_rows = [
        ["Imię i nazwisko:", order.get("fullName") or order.get("customerName") or order.get("clientName") or "—"],
        ["Telefon:", order.get("phoneNumber") or order.get("customerPhone") or order.get("phone") or "—"],
        ["Email:", order.get("email") or order.get("customerEmail") or "—"],
    ]
    t = Table(client_rows, colWidths=[40 * mm, 120 * mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6b7280")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 6 * mm))

    # ----- Model & options -----
    story.append(Paragraph("Konfiguracja sauny", h2))
    rows = [["Pozycja", "Ilość", "Cena"]]

    base = int(order.get("basePrice") or order.get("modelBasePrice") or 0)
    variant_price = int(order.get("variantPrice") or 0)
    model_name = order.get("modelName") or "Sauna"
    variant_name = order.get("modelVariantName") or order.get("variantName")
    base_total = base + variant_price
    if variant_name:
        rows.append([f"{model_name} ({variant_name})", "1", _fmt_pln(base_total)])
    else:
        rows.append([model_name, "1", _fmt_pln(base_total)])

    options = order.get("options") or []
    selected_options = order.get("selectedOptions") or []
    # Build the items list — prefer richer `selectedOptions` (manager-style),
    # fall back to legacy flat `options[]` for older dealer orders.
    items: list[dict] = []
    if selected_options:
        for o in selected_options:
            qty = int(o.get("quantity") or 1)
            items.append({
                "name": o.get("name") or o.get("optionName") or "—",
                "categoryName": o.get("categoryName") or "",
                "qty": qty,
                "totalPrice": int(o.get("totalPrice") or (int(o.get("price") or 0) * qty)),
            })
    else:
        for o in options:
            qty = int(o.get("quantity") or 1)
            items.append({
                "name": o.get("optionName") or "—",
                "categoryName": o.get("categoryName") or "",
                "qty": qty,
                "totalPrice": int(o.get("totalPrice") or (int(o.get("price") or 0) * qty)),
            })

    for it in items:
        name = it["name"]
        if it["categoryName"]:
            name = f"{it['categoryName']} · {name}"
        rows.append([name, str(it["qty"]), _fmt_pln(it["totalPrice"])])

    options_table = Table(rows, colWidths=[110 * mm, 20 * mm, 40 * mm], repeatRows=1)
    options_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(options_table)
    story.append(Spacer(1, 4 * mm))

    # ----- Totals -----
    subtotal = int(order.get("subtotal") or order.get("total") or 0)
    total = int(order.get("total") or subtotal)
    options_total = int(order.get("optionsTotal") or 0)

    totals_rows = []
    if options_total:
        totals_rows.append(["Opcje:", _fmt_pln(options_total)])
    totals_rows.append(["Suma:", _fmt_pln(subtotal)])
    if total != subtotal:
        totals_rows.append(["Do zapłaty:", _fmt_pln(total)])

    totals = Table(totals_rows, colWidths=[130 * mm, 40 * mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TEXTCOLOR", (0, 0), (-1, -2), colors.HexColor("#6b7280")),
        ("FONTSIZE", (0, -1), (-1, -1), 13),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#ea580c")),
        ("FONTNAME", (0, -1), (-1, -1), font),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
    ]))
    story.append(totals)
    story.append(Spacer(1, 8 * mm))

    # ----- Notes / footer -----
    if order.get("notes"):
        story.append(Paragraph("Uwagi", h2))
        story.append(Paragraph(str(order["notes"]).replace("\n", "<br/>"), body))
        story.append(Spacer(1, 6 * mm))

    story.append(Paragraph(
        "Oferta ważna 14 dni od daty wystawienia. Ceny zawierają podatek VAT.",
        muted,
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
