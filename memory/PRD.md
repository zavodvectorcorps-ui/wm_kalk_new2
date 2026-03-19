# WM Kalkulator - Product Requirements Document

## Original Problem Statement
Comprehensive logistics and sales management system for sauna and hot tub business with calculators, order management, logistics, training modules, and CRM integrations.

## Latest Updates

### Mar 19, 2026 - FEATURE: Тех. задание — кнопка "Создать PDF" (COMPLETED)
- **NEW**: Кнопка "Создать PDF" в модалке технического задания (TechSpecModal)
- Бэкенд `/api/sauna/generate-tech-spec-pdf` полностью переписан под новую структуру (4 секции, 21 категория)
- Без leadId → скачивается PDF файл. С leadId → загрузка в Cloudinary + привязка к документам лида CRM
- Условные поля (печь: мощность/загрузка), custom-поля (Другой размер панорамы), лавки с фото из калькулятора
- Воздушные клапаны: категория с defaultValue "Да"
- **Testing**: Backend 9/9, Frontend 100%

### Mar 19, 2026 - FEATURE: Тех. задание переделано с нуля (COMPLETED)
- Полностью новая структура: 4 секции (Общее, Парная, Комната отдыха, Электрика), 21 категория
- Категории: Модель/Размер, Исполнение, Цвет сауны/крыши, Лавки, Подспинники, Ограждение печки, Печь, Дымоход, Форточки, Воздушные клапаны, Панорамы, Дверь, Скамьи, Душевой поддон, Бойлер, Электрика
- Автоматический перенос данных из калькулятора через calcCategoryMapping
- Условные поля, секционные заголовки, лавки с фото

### Mar 19, 2026 - FEATURE: Производство саун (COMPLETED)
- Отдельная страница с Календарём и Канбаном
- Кнопка "В производство" в CRM

### Mar 19, 2026 - FEATURE: Тех. задание в CRM (COMPLETED)
- Интеграция калькулятора и тех. задания в мини-CRM

### Mar 19, 2026 - BUGFIX: PDF ссылка None в amoCRM (FIXED)
### Mar 19, 2026 - BUGFIX: Планировка не загружается в тех.задание (FIXED)
### Mar 19, 2026 - BUGFIX: КП PDF не прикрепляется к документам лида (FIXED)

## Technical Architecture

```
/app
├── backend (FastAPI)
│   ├── routes/
│   │   ├── amocrm.py        # CRM integration
│   │   ├── sauna.py          # Sauna orders, PDF generation, tech spec PDF
│   │   ├── sauna_crm.py      # Mini-CRM, documents, calendar
│   │   ├── sauna_production.py # Production board
│   │   ├── sauna_crud.py     # CRUD operations
│   │   ├── sauna_orders.py   # Orders management
│   │   └── server.py
│   └── services/
│       └── cloudinary_service.py # PDF & image uploads
└── frontend (React)
    └── src/
        ├── components/
        │   ├── tech-spec/
        │   │   ├── TechSpecModal.jsx   # Tech spec form + PDF generation
        │   │   └── techSpecData.js     # 4 sections, 21 categories
        │   ├── SaunaCRMPage.jsx
        │   ├── SaunaProductionPage.jsx
        │   └── ...
```

## Key API Endpoints
- `POST /api/sauna/generate-tech-spec-pdf` - Generate tech spec PDF (with optional Cloudinary upload)
- `POST /api/sauna-crm/leads/{lead_id}/documents/link` - Link document to CRM lead
- `POST /api/sauna-crm/leads/{lead_id}/to-production` - Send to production

## Pending Issues
- **P0**: Incorrect automatic variant application in LayoutConfiguratorPage.jsx (CRITICAL, recurring)
- **P1**: Unstable user login sessions (recurring)
- **P2**: Upstream timed out errors during deployment (recurring)

## Backlog

### P0 (Critical)
- [ ] Fix automatic variant application in LayoutConfiguratorPage.jsx

### P1 (High Priority)
- [ ] Finalize "Save layout to order" feature end-to-end
- [ ] Refactor monolithic amocrm.py
- [ ] Refactor LayoutConfiguratorPage.jsx (tech debt)
- [ ] Fix unstable login sessions

### P2 (Medium Priority)
- [ ] UI for backup import/restore
- [ ] Replace deprecated Google Maps Autocomplete

## 3rd Party Integrations
- **Cloudinary**: Image & PDF storage
- **amoCRM/Kommo**: CRM integration
- **Nano Banana Pro (Gemini)**: AI image generation (Emergent LLM Key)
- **Telegram**: Notifications
- **Google Maps**: Delivery routes
- **Fabric.js**: Layout configurator

## Test Credentials
- Admin: `admin` / `admin123`
