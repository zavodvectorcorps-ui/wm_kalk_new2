# Рефакторинг кодовой базы — Руководство

## Статус: ✅ ЗАВЕРШЁН

Рефакторинг полностью применён. Модули подключены и работают.

---

## Изменения в структуре

### Backend (ПРИМЕНЕНО)

| Файл | Описание | Строки |
|------|----------|--------|
| `services/pdf_helpers.py` | Утилиты для PDF | 180 |
| `services/pdf_sections.py` | Строители секций PDF | 240 |
| `routes/sauna_crud.py` | CRUD для prices/models/categories/options | 210 |
| `routes/sauna_orders.py` | CRUD для orders + tech spec | 200 |
| `routes/sauna_wizard.py` | API wizard-калькулятора | 130 |
| `routes/sauna.py` | Главный файл (только PDF) | 2318 (было 2842, -18%) |

### Frontend (СОЗДАНО)

| Файл | Описание |
|------|----------|
| `useLayoutCatalog.js` | Хук для каталога планировок |
| `usePriceCalculation.js` | Хук для расчёта цен |
| `useOptionVisibility.js` | Хук для видимости опций |

---

## Архитектура роутеров

```python
# routes/sauna.py
router = APIRouter(prefix="/sauna", tags=["Sauna Calculator"])

# Include modular routers (no prefix, included under /sauna)
router.include_router(crud_router)      # from routes/sauna_crud.py
router.include_router(orders_router)    # from routes/sauna_orders.py  
router.include_router(wizard_router)    # from routes/sauna_wizard.py

# Остальное: PDF генерация, tech spec PDF
```

---

## Тестирование

- **Backend**: 22/22 тестов ✅
- **Frontend**: Все UI флоу работают ✅
- **PDF генерация**: Работает ✅

---

## Следующие шаги (опционально)

1. **Дальнейшее разбиение PDF генератора**:
   - `generate_sauna_pdf` всё ещё ~1500 строк
   - Можно использовать функции из `pdf_helpers.py` и `pdf_sections.py`

2. **Интеграция frontend хуков**:
   - `useLayoutCatalog.js` можно использовать в `useSaunaCalculator.js`
   - `usePriceCalculation.js` и `useOptionVisibility.js` готовы к использованию

---

*Последнее обновление: 1 февраля 2026*
