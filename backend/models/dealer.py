"""Dealer Pydantic models for the dealer portal."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Dealer(BaseModel):
    """A dealer who can use the sauna calculator with their own pricing."""
    model_config = ConfigDict(extra="allow")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str  # login (lowercase)
    password: str = ""  # hashed
    name: str = ""  # company / display name
    email: Optional[str] = ""
    phone: Optional[str] = ""
    notes: Optional[str] = ""
    isActive: bool = True
    orderPrefix: Optional[str] = ""  # custom prefix for dealer's order IDs, e.g. "ABC" -> "ABC-XXXXX"
    createdAt: str = Field(default_factory=_now_iso)
    updatedAt: str = Field(default_factory=_now_iso)


class DealerCreate(BaseModel):
    username: str
    password: str
    name: str = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    notes: Optional[str] = ""
    orderPrefix: Optional[str] = ""


class DealerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    isActive: Optional[bool] = None
    password: Optional[str] = None  # if set, will rehash
    orderPrefix: Optional[str] = None


class DealerLogin(BaseModel):
    username: str
    password: str


class DealerPriceOverride(BaseModel):
    """A dealer-specific price for a single sauna catalog item.

    Lookup key: (dealerId, kind, modelId, variantId?, optionId?, optionVariantId?)
    Only one of {model, model_variant, option, option_variant} is meaningful per row.

    Two independent prices are tracked per override row:
      * ``price`` (B2B Brutto) — what the dealer pays to WM.
        Owned/edited by admin only (via Price Simulator → "Apply to dealer").
        Dealer never edits this directly.
      * ``dealerRetailPrice`` (Retail Brutto) — what the dealer charges his client.
        Owned/edited by the dealer himself in "Moje ceny detaliczne".

    Either side may be ``None`` (= fallback to the base WM Brutto from sauna_prices).
    """
    model_config = ConfigDict(extra="allow")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dealerId: str
    kind: str  # "model" | "model_variant" | "option" | "option_variant"
    modelId: Optional[str] = None  # for model + model_variant
    variantId: Optional[str] = None  # for model_variant
    optionId: Optional[str] = None  # for option + option_variant
    optionVariantId: Optional[str] = None  # for option_variant
    price: Optional[int] = None        # B2B Brutto (manufacturer→dealer). None = use base.
    dealerRetailPrice: Optional[int] = None  # Retail Brutto (dealer→client). None = use base.
    updatedAt: str = Field(default_factory=_now_iso)


class DealerPriceOverridesBulk(BaseModel):
    """Bulk-set price overrides for one dealer."""
    overrides: list[DealerPriceOverride]
