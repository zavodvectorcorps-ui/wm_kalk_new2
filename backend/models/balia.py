"""Balia calculator models."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Any
from datetime import datetime, timezone
import uuid


class PriceData(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    shellModels: Dict[str, float] = {}
    woodTypes: Dict[str, float] = {}
    shellColors: Dict[str, float] = {}
    lidTypes: Dict[str, float] = {}
    woodColors: Dict[str, float] = {}
    features: Dict[str, float] = {}
    displayTypes: Dict[str, str] = {}
    categories: Dict[str, Dict[str, Any]] = {}
    optionCategories: Dict[str, str] = {}
    optionLabels: Dict[str, str] = {}


class OrderFeatures(BaseModel):
    jacuzzi: bool = False
    airBubble: bool = False
    outsideLed12: bool = False
    insideLed: bool = False
    outsideLedStripe: bool = False
    insideLedMini: bool = False
    insulation: bool = False
    headPillow: bool = False
    v4aHeater: bool = False
    electricityBox: bool = False
    chimneyExtension: bool = False
    extraChimneyProtection: bool = False
    bluetoothRadio: bool = False
    electricHeater3kw: bool = False
    electricThermometer: bool = False


class Order(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: str
    shellModel: str
    woodType: str
    shellColor: str
    lidType: str
    woodColor: str
    sandFilter: str = "none"
    features: Dict[str, bool] = {}
    notes: str = ""
    total: float = 0.0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PDFRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    fullName: str
    phoneNumber: str
    fullAddress: str
    orderDate: str
    shellModel: str
    woodType: str
    shellColor: str
    lidType: str
    woodColor: str
    sandFilter: str = "none"
    features: Dict[str, bool] = {}
    notes: str = ""
    total: float = 0.0
    type: str = "customer"
    language: str = "ru"
