"""FAQ management routes for calculators."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import os
from pymongo import MongoClient

router = APIRouter(prefix="/faq", tags=["faq"])

# MongoDB connection
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "wm_calculator")
client = MongoClient(mongo_url)
db = client[db_name]
faq_collection = db["faq_items"]


class FAQItem(BaseModel):
    id: Optional[str] = None
    calculator_type: str  # 'sauna', 'balia', 'both'
    category: str  # 'calculator_guide', 'amocrm_integration', 'products'
    question: str
    answer: str
    imageUrl: Optional[str] = None
    videoUrl: Optional[str] = None
    order: int = 0
    isActive: bool = True
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class FAQItemCreate(BaseModel):
    calculator_type: str
    category: str
    question: str
    answer: str
    imageUrl: Optional[str] = None
    videoUrl: Optional[str] = None
    order: int = 0
    isActive: bool = True


class FAQItemUpdate(BaseModel):
    calculator_type: Optional[str] = None
    category: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    imageUrl: Optional[str] = None
    videoUrl: Optional[str] = None
    order: Optional[int] = None
    isActive: Optional[bool] = None


@router.get("")
async def get_faq_items(calculator_type: str = None, category: str = None):
    """Get FAQ items, optionally filtered by calculator type and category."""
    query = {}
    if calculator_type:
        query["$or"] = [
            {"calculator_type": calculator_type},
            {"calculator_type": "both"}
        ]
    if category:
        query["category"] = category
    
    items = list(faq_collection.find(query, {"_id": 0}).sort("order", 1))
    return items


@router.get("/all")
async def get_all_faq_items():
    """Get all FAQ items for admin panel."""
    items = list(faq_collection.find({}, {"_id": 0}).sort([("calculator_type", 1), ("category", 1), ("order", 1)]))
    return items


@router.post("")
async def create_faq_item(item: FAQItemCreate):
    """Create a new FAQ item."""
    now = datetime.now(timezone.utc).isoformat()
    
    # Generate unique ID
    item_id = f"faq-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{ObjectId()}"
    
    item_dict = item.model_dump()
    item_dict["id"] = item_id
    item_dict["createdAt"] = now
    item_dict["updatedAt"] = now
    
    faq_collection.insert_one(item_dict)
    
    # Return without _id
    result = faq_collection.find_one({"id": item_id}, {"_id": 0})
    return result


@router.put("/{item_id}")
async def update_faq_item(item_id: str, item: FAQItemUpdate):
    """Update an FAQ item."""
    existing = faq_collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="FAQ item not found")
    
    update_data = {k: v for k, v in item.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    faq_collection.update_one({"id": item_id}, {"$set": update_data})
    
    result = faq_collection.find_one({"id": item_id}, {"_id": 0})
    return result


@router.delete("/{item_id}")
async def delete_faq_item(item_id: str):
    """Delete an FAQ item."""
    result = faq_collection.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="FAQ item not found")
    return {"status": "deleted", "id": item_id}


@router.post("/reorder")
async def reorder_faq_items(items: List[dict]):
    """Update order of multiple FAQ items."""
    for item in items:
        if "id" in item and "order" in item:
            faq_collection.update_one(
                {"id": item["id"]},
                {"$set": {"order": item["order"], "updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
    return {"status": "ok"}


@router.post("/import-hints/{calculator_type}")
async def import_hints_to_faq(calculator_type: str):
    """Import existing hints from pricing as FAQ items."""
    imported_count = 0
    
    if calculator_type in ["sauna", "both"]:
        # Import sauna hints
        sauna_prices = db["sauna_prices"].find_one({})
        if sauna_prices:
            # Models hint
            if sauna_prices.get("modelsHint"):
                existing = faq_collection.find_one({
                    "calculator_type": "sauna",
                    "category": "products",
                    "question": "Модели саун"
                })
                if not existing:
                    faq_collection.insert_one({
                        "id": f"faq-sauna-models-{ObjectId()}",
                        "calculator_type": "sauna",
                        "category": "products",
                        "question": "Модели саун",
                        "answer": sauna_prices.get("modelsHint", ""),
                        "imageUrl": sauna_prices.get("modelsHintImageUrl"),
                        "videoUrl": sauna_prices.get("modelsHintVideoUrl"),
                        "order": 0,
                        "isActive": True,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "updatedAt": datetime.now(timezone.utc).isoformat()
                    })
                    imported_count += 1
            
            # Category hints
            for idx, cat in enumerate(sauna_prices.get("categories", [])):
                if cat.get("hint"):
                    existing = faq_collection.find_one({
                        "calculator_type": "sauna",
                        "category": "products",
                        "question": cat.get("name", f"Категория {idx+1}")
                    })
                    if not existing:
                        faq_collection.insert_one({
                            "id": f"faq-sauna-cat-{idx}-{ObjectId()}",
                            "calculator_type": "sauna",
                            "category": "products",
                            "question": cat.get("name", f"Категория {idx+1}"),
                            "answer": cat.get("hint", ""),
                            "imageUrl": cat.get("hintImageUrl"),
                            "videoUrl": cat.get("hintVideoUrl"),
                            "order": idx + 10,
                            "isActive": True,
                            "createdAt": datetime.now(timezone.utc).isoformat(),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        })
                        imported_count += 1
                
                # Option hints
                for opt_idx, opt in enumerate(cat.get("options", [])):
                    if opt.get("hint"):
                        existing = faq_collection.find_one({
                            "calculator_type": "sauna",
                            "category": "products",
                            "question": opt.get("name", f"Опция {opt_idx+1}")
                        })
                        if not existing:
                            faq_collection.insert_one({
                                "id": f"faq-sauna-opt-{idx}-{opt_idx}-{ObjectId()}",
                                "calculator_type": "sauna",
                                "category": "products",
                                "question": opt.get("name", f"Опция {opt_idx+1}"),
                                "answer": opt.get("hint", ""),
                                "imageUrl": opt.get("hintImageUrl"),
                                "videoUrl": opt.get("hintVideoUrl"),
                                "order": 100 + idx * 10 + opt_idx,
                                "isActive": True,
                                "createdAt": datetime.now(timezone.utc).isoformat(),
                                "updatedAt": datetime.now(timezone.utc).isoformat()
                            })
                            imported_count += 1
    
    if calculator_type in ["balia", "both"]:
        # Import balia hints
        balia_prices = db["balia_prices"].find_one({})
        if balia_prices:
            # Models hint
            if balia_prices.get("modelsHint"):
                existing = faq_collection.find_one({
                    "calculator_type": "balia",
                    "category": "products",
                    "question": "Модели купелей"
                })
                if not existing:
                    faq_collection.insert_one({
                        "id": f"faq-balia-models-{ObjectId()}",
                        "calculator_type": "balia",
                        "category": "products",
                        "question": "Модели купелей",
                        "answer": balia_prices.get("modelsHint", ""),
                        "imageUrl": balia_prices.get("modelsHintImageUrl"),
                        "videoUrl": balia_prices.get("modelsHintVideoUrl"),
                        "order": 0,
                        "isActive": True,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "updatedAt": datetime.now(timezone.utc).isoformat()
                    })
                    imported_count += 1
            
            # Category hints
            for idx, cat in enumerate(balia_prices.get("categories", [])):
                if cat.get("hint"):
                    existing = faq_collection.find_one({
                        "calculator_type": "balia",
                        "category": "products",
                        "question": cat.get("name", f"Категория {idx+1}")
                    })
                    if not existing:
                        faq_collection.insert_one({
                            "id": f"faq-balia-cat-{idx}-{ObjectId()}",
                            "calculator_type": "balia",
                            "category": "products",
                            "question": cat.get("name", f"Категория {idx+1}"),
                            "answer": cat.get("hint", ""),
                            "imageUrl": cat.get("hintImageUrl"),
                            "videoUrl": cat.get("hintVideoUrl"),
                            "order": idx + 10,
                            "isActive": True,
                            "createdAt": datetime.now(timezone.utc).isoformat(),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        })
                        imported_count += 1
                
                # Option hints
                for opt_idx, opt in enumerate(cat.get("options", [])):
                    if opt.get("hint"):
                        existing = faq_collection.find_one({
                            "calculator_type": "balia",
                            "category": "products",
                            "question": opt.get("name", f"Опция {opt_idx+1}")
                        })
                        if not existing:
                            faq_collection.insert_one({
                                "id": f"faq-balia-opt-{idx}-{opt_idx}-{ObjectId()}",
                                "calculator_type": "balia",
                                "category": "products",
                                "question": opt.get("name", f"Опция {opt_idx+1}"),
                                "answer": opt.get("hint", ""),
                                "imageUrl": opt.get("hintImageUrl"),
                                "videoUrl": opt.get("hintVideoUrl"),
                                "order": 100 + idx * 10 + opt_idx,
                                "isActive": True,
                                "createdAt": datetime.now(timezone.utc).isoformat(),
                                "updatedAt": datetime.now(timezone.utc).isoformat()
                            })
                            imported_count += 1
    
    return {"status": "ok", "imported_count": imported_count}


@router.post("/seed-defaults")
async def seed_default_faq_items():
    """Seed default FAQ items about calculator usage and amoCRM integration."""
    default_items = [
        # Calculator Guide - Both calculators
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Как создать коммерческое предложение?",
            "answer": """1. Выберите модель из списка доступных моделей
2. Настройте необходимые опции, отмечая чекбоксы
3. Для некоторых опций можно указать количество
4. Заполните данные клиента (имя, телефон, адрес)
5. Нажмите кнопку "Сохранить и скачать PDF"
6. PDF-файл автоматически скачается на ваш компьютер""",
            "order": 1
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Как применить скидку?",
            "answer": """Скидки до 10% могут применять все менеджеры.
Для скидки более 10% требуется одобрение администратора.

Чтобы запросить скидку:
1. Укажите желаемый процент скидки в поле "Запрашиваемая скидка"
2. Добавьте комментарий с обоснованием
3. Администратор получит уведомление и сможет одобрить скидку""",
            "order": 2
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Как сделать опцию подарком?",
            "answer": """Администраторы и менеджеры с правами редактирования могут отмечать опции как подарки.

1. Откройте заказ на редактирование
2. Найдите нужную опцию
3. Нажмите на иконку подарка рядом с опцией
4. Опция станет бесплатной и будет отмечена как подарок в PDF""",
            "order": 3
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Где найти созданные заказы?",
            "answer": """Все созданные заказы доступны в разделе "Заказы" соответствующего калькулятора.

Для саун: меню → Калькулятор саун → Заказы
Для купелей: меню → Калькулятор купелей → Заказы

В списке заказов можно:
- Просмотреть детали заказа
- Скачать PDF повторно
- Редактировать заказ
- Удалить заказ""",
            "order": 4
        },
        # amoCRM Integration
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Как открыть калькулятор из amoCRM?",
            "answer": """В карточке сделки amoCRM есть виджет калькулятора.

1. Откройте нужную сделку в amoCRM
2. Найдите виджет "Калькулятор" в правой панели
3. Нажмите на ссылку калькулятора (Sauna или Balia)
4. Калькулятор откроется с привязкой к этой сделке

Все созданные КП автоматически:
- Сохраняются в системе
- Прикрепляются к сделке в amoCRM
- Добавляют примечание с информацией о заказе""",
            "order": 10
        },
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Что происходит при создании КП из amoCRM?",
            "answer": """При создании коммерческого предложения из сделки amoCRM:

1. PDF генерируется и скачивается на ваш компьютер
2. PDF загружается в файлы сделки amoCRM
3. В сделку добавляется примечание с информацией:
   - Номер заказа
   - Тип калькулятора
   - Имя сотрудника
   - Сумма заказа
   - Ссылка на скачивание PDF

4. Заказ сохраняется в системе и виден в разделе "Заказы" """,
            "order": 11
        },
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Почему заказ не отображается в списке?",
            "answer": """Если заказ создан из amoCRM, но не отображается в списке заказов калькулятора:

1. Проверьте, что вы авторизованы в системе
2. Обновите страницу (F5)
3. Проверьте фильтры — возможно, применён фильтр по типу заказа

Заказы из amoCRM имеют специальную метку и могут фильтроваться отдельно от обычных заказов.""",
            "order": 12
        },
        # Sauna specific
        {
            "calculator_type": "sauna",
            "category": "products",
            "question": "Какие модели саун доступны?",
            "answer": """В калькуляторе представлены различные модели саун разных размеров и конфигураций.

Каждая модель имеет:
- Базовую цену
- Описание и характеристики
- Фотографии
- Доступные опции

Выберите модель, которая лучше всего подходит под требования клиента по размеру и бюджету.""",
            "order": 50
        },
        # Balia specific
        {
            "calculator_type": "balia",
            "category": "products",
            "question": "Какие модели купелей доступны?",
            "answer": """В калькуляторе представлены купели разных размеров и материалов.

Основные параметры моделей:
- Размер (диаметр/вместимость)
- Материал изготовления
- Базовая комплектация
- Цена

При выборе учитывайте количество людей, которые будут пользоваться купелью одновременно.""",
            "order": 50
        },
    ]
    
    created_count = 0
    for item in default_items:
        existing = faq_collection.find_one({
            "calculator_type": item["calculator_type"],
            "category": item["category"],
            "question": item["question"]
        })
        if not existing:
            item["id"] = f"faq-default-{created_count}-{ObjectId()}"
            item["isActive"] = True
            item["createdAt"] = datetime.now(timezone.utc).isoformat()
            item["updatedAt"] = datetime.now(timezone.utc).isoformat()
            faq_collection.insert_one(item)
            created_count += 1
    
    return {"status": "ok", "created_count": created_count}
