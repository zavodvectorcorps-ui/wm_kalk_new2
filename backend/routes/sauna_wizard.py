"""Wizard calculator API for sauna."""
from fastapi import APIRouter
from database import db
from models.sauna import WizardStep

# No prefix - will be included in main sauna router
router = APIRouter(tags=["Sauna Wizard"])

DEFAULT_WIZARD_STEPS = [
    {
        "id": "model",
        "name": "Model",
        "nameRu": "Модель",
        "icon": "Home",
        "description": "Wybierz model sauny",
        "descriptionRu": "Выберите модель сауны",
        "categoryNames": [],
        "sortOrder": 0,
        "isActive": True,
        "isRequired": True
    },
    {
        "id": "variant",
        "name": "Wariant",
        "nameRu": "Вариант планировки",
        "icon": "LayoutGrid",
        "description": "Wybierz wariant układu",
        "descriptionRu": "Выберите вариант планировки",
        "categoryNames": [],
        "sortOrder": 1,
        "isActive": True,
        "isRequired": False
    },
    {
        "id": "stove",
        "name": "Piec",
        "nameRu": "Печь",
        "icon": "Flame",
        "description": "Wybierz rodzaj pieca",
        "descriptionRu": "Выберите тип печи",
        "categoryNames": ["Piece", "piece", "piec"],
        "sortOrder": 2,
        "isActive": True,
        "isRequired": True
    },
    {
        "id": "stove-position",
        "name": "Strona pieca",
        "nameRu": "Расположение печи",
        "icon": "ArrowRight",
        "description": "Wybierz stronę pieca",
        "descriptionRu": "Выберите сторону печи",
        "categoryNames": ["Strona Pieca", "strona pieca"],
        "sortOrder": 3,
        "isActive": True,
        "isRequired": True
    },
    {
        "id": "benches",
        "name": "Ławki",
        "nameRu": "Лавки",
        "icon": "Sofa",
        "description": "Wybierz rodzaj ławek",
        "descriptionRu": "Выберите тип лавок",
        "categoryNames": ["Ławki", "lawki", "ławka"],
        "sortOrder": 4,
        "isActive": True,
        "isRequired": True
    },
    {
        "id": "other",
        "name": "Dodatkowe opcje",
        "nameRu": "Доп. опции",
        "icon": "Package",
        "description": "Wybierz dodatkowe opcje",
        "descriptionRu": "Выберите дополнительные опции",
        "categoryNames": [],
        "sortOrder": 5,
        "isActive": True,
        "isRequired": False
    }
]


@router.get("/wizard-steps")
async def get_wizard_steps():
    """Get wizard steps configuration."""
    steps = await db.sauna_wizard_steps.find({}).sort("sortOrder", 1).to_list(100)
    
    # If no steps configured, return defaults
    if not steps:
        return DEFAULT_WIZARD_STEPS
    
    # Remove MongoDB _id field
    for step in steps:
        step.pop("_id", None)
    
    return steps


@router.put("/wizard-steps")
async def update_wizard_steps(steps: list[WizardStep]):
    """Update wizard steps configuration (replaces all steps)."""
    # Clear existing steps
    await db.sauna_wizard_steps.delete_many({})
    
    # Insert new steps with sort order
    steps_data = []
    for i, step in enumerate(steps):
        step_dict = step.model_dump()
        step_dict["sortOrder"] = i
        steps_data.append(step_dict)
    
    if steps_data:
        await db.sauna_wizard_steps.insert_many(steps_data)
    
    return {"success": True, "count": len(steps_data)}


@router.post("/wizard-steps/reset")
async def reset_wizard_steps():
    """Reset wizard steps to defaults."""
    await db.sauna_wizard_steps.delete_many({})
    await db.sauna_wizard_steps.insert_many(DEFAULT_WIZARD_STEPS)
    return {"success": True, "message": "Wizard steps reset to defaults"}
