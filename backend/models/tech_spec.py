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
    masterCategoryId: Optional[str] = None  # Reference to master category
    inputType: str = "radio"  # radio, checkbox, text, textarea, mixed
    layout: str = "column"  # row, column
    displayWidth: str = "half"  # full, half (full width or two columns)
    hasImages: bool = False
    sortOrder: int = 0
    options: List[TechSpecOption] = []


class TechSpecMasterCategory(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str
    name: str
    sortOrder: int = 0


class TechSpecData(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    masterCategories: List[TechSpecMasterCategory] = []
    categories: List[TechSpecCategory] = []
