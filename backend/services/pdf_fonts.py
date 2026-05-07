"""Robust font registration for reportlab — survives container resets.

Searches multiple known locations for DejaVuSans / DejaVuSans-Bold and
falls back to the bundled copies in `/app/backend/assets/fonts/`.
"""
from __future__ import annotations

import os
from typing import Optional

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont

_REGISTERED = False

# Candidate paths in priority order
_REGULAR_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "DejaVuSans.ttf"),
    "/app/backend/assets/fonts/DejaVuSans.ttf",
]
_BOLD_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "DejaVuSans-Bold.ttf"),
    "/app/backend/assets/fonts/DejaVuSans-Bold.ttf",
]


def _first_existing(paths) -> Optional[str]:
    for p in paths:
        try:
            if os.path.isfile(p):
                return p
        except Exception:
            continue
    return None


def ensure_pdf_fonts(force: bool = False) -> bool:
    """Register DejaVuSans + DejaVuSans-Bold + family. Idempotent.

    Returns True if both fonts are registered (regular + bold) and the family
    is configured so reportlab can resolve <b> tags inside Paragraphs.
    """
    global _REGISTERED
    if _REGISTERED and not force:
        return True

    regular = _first_existing(_REGULAR_PATHS)
    bold = _first_existing(_BOLD_PATHS)
    if not regular or not bold:
        return False

    try:
        # registerFont is silently idempotent on the same name
        pdfmetrics.registerFont(TTFont("DejaVuSans", regular))
        pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold))
        registerFontFamily(
            "DejaVuSans",
            normal="DejaVuSans",
            bold="DejaVuSans-Bold",
            italic="DejaVuSans",
            boldItalic="DejaVuSans-Bold",
        )
        _REGISTERED = True
        return True
    except Exception:
        return False
