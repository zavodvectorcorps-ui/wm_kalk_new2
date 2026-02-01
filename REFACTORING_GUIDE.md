# Рефакторинг кодовой базы — Руководство

## Обзор

Данный документ описывает выполненный рефакторинг и планы по дальнейшей модуляризации кодовой базы.

---

## Выполненный рефакторинг

### Backend

Созданы модульные файлы для лучшей организации кода:

| Файл | Описание | Статус |
|------|----------|--------|
| `services/pdf_helpers.py` | Утилиты для работы с PDF (оптимизация изображений, загрузка из MongoDB) | ✅ Создан |
| `services/pdf_sections.py` | Строители секций PDF (header, client_info, promo, gallery) | ✅ Создан |
| `routes/sauna_crud.py` | CRUD операции для моделей, категорий, опций | ✅ Создан |
| `routes/sauna_orders.py` | CRUD операции для заказов + tech spec | ✅ Создан |
| `routes/sauna_wizard.py` | API для wizard-калькулятора | ✅ Создан |
| `routes/sauna_pdf_legacy.py` | Бэкап оригинального файла | ✅ Бэкап |

### Frontend

Созданы специализированные хуки:

| Файл | Описание | Статус |
|------|----------|--------|
| `useLayoutCatalog.js` | Логика каталога планировок | ✅ Создан |
| `usePriceCalculation.js` | Расчёт цен | ✅ Создан |
| `useOptionVisibility.js` | Видимость опций по правилам | ✅ Создан |

---

## Структура файлов

```
/app/backend
├── services/
│   ├── pdf_helpers.py       # Утилиты для PDF
│   └── pdf_sections.py      # Строители секций PDF
├── routes/
│   ├── sauna.py             # Главный файл (оставлен без изменений)
│   ├── sauna_crud.py        # CRUD модели/категории/опции
│   ├── sauna_orders.py      # CRUD заказы
│   ├── sauna_wizard.py      # Wizard API
│   └── sauna_pdf_legacy.py  # Бэкап оригинала

/app/frontend/src/components/sauna
├── index.js                 # Экспорт всех хуков
├── useSaunaCalculator.js    # Главный хук (оставлен без изменений)
├── useLayoutCatalog.js      # Каталог планировок
├── usePriceCalculation.js   # Расчёт цен
├── useOptionVisibility.js   # Видимость опций
└── constants.js             # Константы
```

---

## План дальнейшего рефакторинга

### Этап 1: Подключение модулей (КРИТИЧЕСКИ)

После стабилизации, обновить `server.py`:

```python
# Добавить импорты
from routes.sauna_crud import router as sauna_crud_router
from routes.sauna_orders import router as sauna_orders_router
from routes.sauna_wizard import router as sauna_wizard_router

# Заменить текущий sauna_router на модульные
# app.include_router(sauna_router, prefix="/api")  # Убрать
app.include_router(sauna_crud_router, prefix="/api")
app.include_router(sauna_orders_router, prefix="/api")
app.include_router(sauna_wizard_router, prefix="/api")
# Оставить PDF генерацию в sauna.py
```

### Этап 2: Разбивка PDF генератора

Файл `sauna.py` содержит функцию `generate_sauna_pdf` (~1600 строк). Рекомендуется:

1. Использовать `pdf_helpers.py` для утилит
2. Использовать `pdf_sections.py` для секций
3. Создать `sauna_pdf_generator.py` как отдельный сервис

### Этап 3: Упрощение главного хука

`useSaunaCalculator.js` (1237 строк) может использовать:

1. `useLayoutCatalog` вместо встроенной логики
2. `usePriceCalculation` вместо встроенных расчётов
3. `useOptionVisibility` вместо встроенной логики

---

## Примечания

- **Оригинальный код НЕ изменён** — приложение работает как прежде
- Модули созданы как **дополнительные** файлы для будущего использования
- Перед подключением модулей необходимо провести полное тестирование

---

## Тестирование

После подключения модулей, проверить:

1. CRUD операции для моделей/категорий/опций
2. CRUD операции для заказов
3. Генерация PDF
4. Wizard API
5. Расчёт цен в калькуляторе
6. Каталог планировок

---

*Последнее обновление: Февраль 2026*
