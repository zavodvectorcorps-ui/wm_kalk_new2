"""Technical Specification models."""
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any


class TechSpecOption(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: str
    imageUrl: Optional[str] = None
    placeholder: Optional[str] = None
    inputType: Optional[str] = None  # For mixed type categories
    required: bool = False


class TechSpecCategory(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: str
    inputType: str = "radio"  # radio, checkbox, text, textarea, mixed
    layout: str = "column"  # row, column
    hasImages: bool = False
    sortOrder: int = 0
    options: List[TechSpecOption] = []


class TechSpecData(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    categories: List[TechSpecCategory] = []
