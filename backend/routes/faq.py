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
    """Seed all default FAQ items about calculator usage, amoCRM integration and products."""
    default_items = [
        # ============ CALCULATOR GUIDE ============
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
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Как выбрать модель для клиента?",
            "answer": """1. Уточните у клиента бюджет и требования по размеру
2. В калькуляторе нажмите на карточку модели для просмотра фото и характеристик
3. Обратите внимание на базовую цену — это стартовая точка
4. Размер модели влияет на стоимость доставки и установки
5. При наведении на иконку "?" рядом с моделью увидите дополнительную информацию""",
            "order": 5
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Как работают опции и количество?",
            "answer": """Опции разделены по категориям (печи, аксессуары, доставка и т.д.)

Для выбора опции:
1. Найдите нужную категорию
2. Отметьте чекбокс рядом с опцией
3. Если опция поддерживает количество — укажите нужное число

Цена автоматически пересчитывается при каждом изменении.

Подсказка: Наведите на иконку "?" рядом с опцией, чтобы увидеть описание и фото.""",
            "order": 6
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Какие данные клиента обязательны?",
            "answer": """Обязательные поля:
• Имя клиента — для PDF и записи в системе
• Телефон — для связи
• Адрес доставки — для расчёта логистики

Необязательные:
• Email — для отправки КП по почте
• Примечания — любая дополнительная информация

Все данные сохраняются в заказе и видны в списке заказов.""",
            "order": 7
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Как редактировать существующий заказ?",
            "answer": """1. Перейдите в раздел "Заказы" (Zamówienia)
2. Найдите нужный заказ в списке
3. Нажмите кнопку "Редактировать" (иконка карандаша)
4. Внесите изменения в калькуляторе
5. Нажмите "Сохранить и скачать PDF"

Важно: История изменений сохраняется автоматически. Вы всегда можете увидеть, кто и когда изменял заказ.""",
            "order": 8
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Что такое \"Запрашиваемая скидка\"?",
            "answer": """Менеджеры могут самостоятельно применять скидки до 10%.

Для скидки более 10%:
1. Укажите желаемый процент в поле "Запрашиваемая скидка"
2. Напишите обоснование в поле "Причина скидки"
3. Сохраните заказ
4. Администратор получит уведомление
5. После одобрения скидка автоматически применится

Статус запроса виден в карточке заказа.""",
            "order": 9
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "PDF не скачивается — что делать?",
            "answer": """Если PDF не скачивается автоматически:

1. Проверьте блокировщик всплывающих окон в браузере
2. Разрешите скачивание файлов с этого сайта
3. Попробуйте другой браузер (Chrome, Firefox)
4. Очистите кэш браузера (Ctrl+Shift+Delete)

Если проблема сохраняется:
• Заказ всё равно сохранён в системе
• Скачайте PDF из раздела "Заказы"
• Сообщите администратору о проблеме""",
            "order": 20
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Как повторно скачать PDF для заказа?",
            "answer": """Чтобы скачать PDF существующего заказа:

1. Откройте раздел "Заказы"
2. Найдите нужный заказ
3. Нажмите кнопку "PDF" (иконка документа)

Или через редактирование:
1. Нажмите "Редактировать" на заказе
2. В калькуляторе нажмите "Сохранить и скачать PDF"

PDF генерируется заново с актуальными данными.""",
            "order": 21
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Как работает история изменений заказа?",
            "answer": """Каждое изменение заказа записывается автоматически:

• Дата и время изменения
• Имя пользователя
• Что именно изменилось

Чтобы посмотреть историю:
1. Откройте заказ на редактирование
2. Прокрутите вниз до раздела "История изменений"

История помогает:
• Отследить все версии КП
• Понять, кто вносил правки
• Восстановить информацию при необходимости""",
            "order": 22
        },
        {
            "calculator_type": "both",
            "category": "calculator_guide",
            "question": "Что такое статистика и как её использовать?",
            "answer": """Раздел "Статистика" показывает:

📊 Общие показатели:
• Количество заказов за период
• Общая сумма продаж
• Средний чек

📈 Графики:
• Динамика заказов по дням/месяцам
• Популярные модели
• Распределение по менеджерам

Фильтры:
• По периоду (неделя, месяц, год)
• По типу калькулятора
• По статусу заказа

Статистика доступна менеджерам и администраторам.""",
            "order": 23
        },
        
        # ============ AMOCRM INTEGRATION ============
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
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Как настроен виджет калькулятора в amoCRM?",
            "answer": """В карточке каждой сделки amoCRM есть виджет с двумя ссылками:

• Калькулятор саун — открывает калькулятор WM-Sauna
• Калькулятор купелей — открывает калькулятор WM-Balia

При переходе по ссылке:
1. Калькулятор автоматически привязывается к сделке
2. Данные клиента (имя, телефон, email) подтягиваются из amoCRM
3. После создания КП — PDF прикрепляется к сделке

Виджет настраивается администратором в разделе Интеграции.""",
            "order": 13
        },
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Что означает сообщение в сделке после создания КП?",
            "answer": """После создания коммерческого предложения в сделку добавляется сообщение:

✅ Коммерческое предложение создано
Заказ: WMS-16-01-2026-123456
Калькулятор: SAUNA
Сотрудник: Имя менеджера
Сумма: 15000.00 zł
2026-01-16 15:30

Это позволяет:
• Видеть историю всех КП по сделке
• Знать, кто и когда создал предложение
• Отслеживать суммы предложений""",
            "order": 14
        },
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Как скачать PDF из сделки amoCRM?",
            "answer": """PDF-файл доступен несколькими способами:

1. Прикреплённый файл — в разделе "Файлы" сделки
2. Ссылка в примечании — "Скачать PDF: https://..."

Если файл не прикрепился автоматически:
• Используйте ссылку из примечания
• Файл скачается на ваш компьютер
• Вы можете прикрепить его вручную или отправить клиенту""",
            "order": 15
        },
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Можно ли создать несколько КП для одной сделки?",
            "answer": """Да, вы можете создавать сколько угодно КП для одной сделки.

Каждое новое КП:
• Получает уникальный номер заказа
• Добавляет новое примечание в сделку
• Сохраняется отдельно в системе

Это полезно когда:
• Клиент просит несколько вариантов комплектации
• Нужно показать разные модели
• Клиент изменил требования

Вся история КП видна в примечаниях сделки.""",
            "order": 16
        },
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Данные клиента не подтянулись из amoCRM — что делать?",
            "answer": """Если данные клиента не заполнились автоматически:

1. Проверьте, заполнены ли поля в карточке контакта amoCRM
2. Убедитесь, что контакт привязан к сделке
3. Заполните данные вручную в калькуляторе

Данные подтягиваются из:
• Имя контакта → Имя клиента
• Телефон контакта → Телефон
• Email контакта → Email

Если проблема повторяется — сообщите администратору.""",
            "order": 17
        },
        {
            "calculator_type": "both",
            "category": "amocrm_integration",
            "question": "Как работает синхронизация с amoCRM?",
            "answer": """Синхронизация происходит автоматически:

📤 Из калькулятора в amoCRM:
• PDF коммерческого предложения
• Информация о заказе (номер, сумма)
• Примечание в сделке

📥 Из amoCRM в калькулятор:
• Данные клиента (имя, телефон, email)
• ID сделки для привязки

⚡ В реальном времени:
• При создании КП из сделки
• При изменении статуса в логистике

Все данные синхронизируются мгновенно.""",
            "order": 18
        },
        
        # ============ PRODUCTS - SAUNA ============
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
        {
            "calculator_type": "sauna",
            "category": "products",
            "question": "Как выбрать печь для сауны?",
            "answer": """Выбор печи зависит от размера сауны и предпочтений клиента:

• Электрические печи — простая установка, не требуют дымохода
• Дровяные печи — традиционный опыт, аромат дерева
• Комбинированные — гибкость использования

Мощность печи рассчитывается по объёму сауны:
• До 10 м³ — 6-8 кВт
• 10-15 м³ — 9-12 кВт
• Более 15 м³ — от 12 кВт

Подсказка в калькуляторе поможет с выбором.""",
            "order": 51
        },
        {
            "calculator_type": "sauna",
            "category": "products",
            "question": "Какие материалы отделки доступны?",
            "answer": """Внутренняя отделка сауны:

• Осина — светлая, не нагревается, гипоаллергенная
• Липа — медовый аромат, мягкая текстура
• Кедр — приятный хвойный запах, антибактериальные свойства
• Термодерево — повышенная влагостойкость

Внешняя отделка:
• Натуральное дерево
• Термообработанная древесина
• Специальные покрытия для улицы

Выбор влияет на цену и срок службы.""",
            "order": 52
        },
        {
            "calculator_type": "sauna",
            "category": "products",
            "question": "Что входит в базовую комплектацию сауны?",
            "answer": """Базовая комплектация включает:

✓ Каркас сауны выбранного размера
✓ Внутренняя обшивка (стандартный материал)
✓ Дверь со стеклом
✓ Полоки (лежаки)
✓ Освещение
✓ Вентиляция

Опционально добавляются:
• Печь (электрическая или дровяная)
• Камни для печи
• Аксессуары (ковши, термометры)
• Доставка и установка""",
            "order": 53
        },
        
        # ============ PRODUCTS - BALIA ============
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
        {
            "calculator_type": "balia",
            "category": "products",
            "question": "Как выбрать размер купели?",
            "answer": """Размер купели выбирается по количеству людей:

• 2-3 человека — диаметр 150-160 см
• 4-5 человек — диаметр 180-200 см
• 6+ человек — диаметр от 220 см

Также учитывайте:
• Место установки (внутри/снаружи)
• Способ нагрева (встроенная/внешняя печь)
• Глубину купели

Большие купели требуют усиленного основания.""",
            "order": 51
        },
        {
            "calculator_type": "balia",
            "category": "products",
            "question": "Какие типы нагрева доступны для купели?",
            "answer": """Варианты нагрева воды:

🔥 Дровяная печь внешняя
• Классический вариант
• Не занимает место в купели
• Требует дымоход

🔥 Дровяная печь встроенная
• Компактное решение
• Быстрый нагрев
• Ограждение внутри купели

⚡ Электрический нагреватель
• Точный контроль температуры
• Автоматическое поддержание
• Требует электроподключения

Время нагрева: 2-4 часа в зависимости от объёма.""",
            "order": 52
        },
        {
            "calculator_type": "balia",
            "category": "products",
            "question": "Какие материалы используются для купелей?",
            "answer": """Материалы корпуса:

• Лиственница — натуральная влагостойкость, долговечность
• Дуб — премиум класс, максимальная прочность
• Термодерево — обработанная древесина, не гниёт
• Кедр — антибактериальные свойства, приятный аромат

Обручи и крепления:
• Нержавеющая сталь
• Оцинкованный металл

Все материалы безопасны для контакта с водой и кожей.""",
            "order": 53
        },
        
        # ============ PRODUCTS - BOTH ============
        {
            "calculator_type": "both",
            "category": "products",
            "question": "Как рассчитывается стоимость доставки?",
            "answer": """Стоимость доставки зависит от:

📍 Расстояния:
• Рассчитывается от склада до адреса клиента
• Учитывается тип дороги

📦 Габаритов товара:
• Размер и вес модели
• Количество мест

🚛 Типа транспорта:
• Стандартная доставка
• Доставка с манипулятором
• Спецтранспорт для крупных моделей

Точная стоимость рассчитывается после указания адреса в калькуляторе.""",
            "order": 60
        },
        # NOTE: Layout variants are now managed in separate collection (sauna_layout_variants)
        # via /api/faq/layout-variants endpoints with structured data and images
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


# ============ SAUNA LAYOUT VARIANTS ============
# Separate collection for structured layout variants with images

layout_variants_collection = db["sauna_layout_variants"]


class LayoutVariantCreate(BaseModel):
    modelSize: str  # "2m", "2.5m", "3m", etc.
    variantNumber: int = 1
    variantName: str = ""
    variantNamePl: str = ""
    description: str = ""
    descriptionPl: str = ""
    imageUrl: str = ""
    terraceSize: Optional[str] = None
    relaxRoomSize: Optional[str] = None
    steamRoomSize: Optional[str] = None
    entranceType: Optional[str] = None
    entranceSide: Optional[str] = None
    peopleCount: Optional[str] = None
    sortOrder: int = 0
    isActive: bool = True
    modelVariantIds: Optional[List[str]] = None  # List of model variant IDs this layout is compatible with


class LayoutVariantUpdate(BaseModel):
    modelSize: Optional[str] = None
    variantNumber: Optional[int] = None
    variantName: Optional[str] = None
    variantNamePl: Optional[str] = None
    description: Optional[str] = None
    descriptionPl: Optional[str] = None
    imageUrl: Optional[str] = None
    terraceSize: Optional[str] = None
    relaxRoomSize: Optional[str] = None
    steamRoomSize: Optional[str] = None
    entranceType: Optional[str] = None
    entranceSide: Optional[str] = None
    peopleCount: Optional[str] = None
    sortOrder: Optional[int] = None
    isActive: Optional[bool] = None
    modelVariantIds: Optional[List[str]] = None  # List of model variant IDs this layout is compatible with


@router.get("/layout-variants")
async def get_layout_variants(model_size: Optional[str] = None, model_variant_id: Optional[str] = None, include_inactive: bool = False):
    """Get all layout variants, optionally filtered by model size and model variant."""
    query = {}
    if model_size:
        query["modelSize"] = model_size
    if not include_inactive:
        query["isActive"] = {"$ne": False}
    
    variants = list(layout_variants_collection.find(query, {"_id": 0}).sort([("modelSize", 1), ("variantNumber", 1), ("sortOrder", 1)]))
    
    # Filter by model variant if specified
    if model_variant_id:
        filtered_variants = []
        for v in variants:
            variant_ids = v.get("modelVariantIds") or []
            # If modelVariantIds is empty/null, show to all variants (backwards compatible)
            # If modelVariantIds has values, check if current variant is in the list
            if not variant_ids or model_variant_id in variant_ids:
                filtered_variants.append(v)
        variants = filtered_variants
    
    return variants


@router.post("/layout-variants")
async def create_layout_variant(variant: LayoutVariantCreate):
    """Create a new layout variant."""
    variant_dict = variant.model_dump()
    variant_dict["id"] = f"lv-{ObjectId()}"
    variant_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    variant_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    layout_variants_collection.insert_one(variant_dict)
    
    # Return without _id
    result = layout_variants_collection.find_one({"id": variant_dict["id"]}, {"_id": 0})
    return result


@router.put("/layout-variants/{variant_id}")
async def update_layout_variant(variant_id: str, update_data: LayoutVariantUpdate):
    """Update a layout variant."""
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    result = layout_variants_collection.update_one(
        {"id": variant_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Layout variant not found")
    
    updated = layout_variants_collection.find_one({"id": variant_id}, {"_id": 0})
    return updated


@router.delete("/layout-variants/{variant_id}")
async def delete_layout_variant(variant_id: str):
    """Delete a layout variant."""
    result = layout_variants_collection.delete_one({"id": variant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Layout variant not found")
    return {"status": "deleted"}


@router.get("/layout-variants/grouped")
async def get_layout_variants_grouped():
    """Get layout variants grouped by model size for FAQ display."""
    variants = list(layout_variants_collection.find(
        {"isActive": {"$ne": False}}, 
        {"_id": 0}
    ).sort([("modelSize", 1), ("variantNumber", 1), ("sortOrder", 1)]))
    
    # Group by model size
    grouped = {}
    model_order = ["2m", "2.5m", "3m", "3.5m", "4m", "5m", "6m"]
    
    for variant in variants:
        size = variant.get("modelSize", "unknown")
        if size not in grouped:
            grouped[size] = []
        grouped[size].append(variant)
    
    # Return as ordered list
    result = []
    for size in model_order:
        if size in grouped:
            result.append({
                "modelSize": size,
                "variants": grouped[size]
            })
    
    # Add any remaining sizes not in model_order
    for size in grouped:
        if size not in model_order:
            result.append({
                "modelSize": size,
                "variants": grouped[size]
            })
    
    return result

