# WM Kalkulator - Product Requirements Document

## Original Problem Statement
Comprehensive logistics and sales management system for sauna and hot tub business with calculators, order management, logistics, training modules, and CRM integrations.

## Latest Updates

### Mar 19, 2026 - BUGFIX: PDF ссылка None в amoCRM (FIXED)
- **Root cause**: `cloudinary_service.py` не загружал `.env` файл, Cloudinary не инициализировался
- **Fix 1**: Добавлен `load_dotenv` в `cloudinary_service.py`
- **Fix 2**: `pdf_download_url` вычисляется до DB-операций (гарантированный fallback)
- Cloudinary upload протестирован: URL генерируется корректно

### Mar 19, 2026 - FEATURE: Производство саун (COMPLETED)
- **NEW FEATURE**: Отдельная страница "Производство саун" с Календарём и Канбаном
  - Доступна через карточку на лендинге, CRM остаётся только во вкладке калькулятора
  - Канбан с 4 настраиваемыми этапами: "Заказ принят" → "В производстве" → "Готов" → "Отгружен"
  - Drag-and-drop перемещение между этапами, история изменений
  - Модалка заказа: инфо клиента (read-only), даты производства, кнопки "Скачать PDF" / "Скачать тех. задание", документы из CRM
  - Кнопка "В производство" в CRM переносит заказ в производство
  - После переноса в CRM отображается предупреждение "Заказ в производстве — сообщите бригадиру"
  - Единая коллекция sauna_crm_leads (поле inProduction) — полная синхронизация
- **Backend**: `/app/backend/routes/sauna_production.py` — 6 endpoints (settings, orders, stage, calendar)
- **Frontend**: `/app/frontend/src/components/SaunaProductionPage.jsx`
- **Testing**: Backend 9/9, Frontend 100%

### Mar 19, 2026 - FEATURE: Тех. задание в CRM (COMPLETED)
- **NEW FEATURE**: Интеграция калькулятора и тех. задания в мини-CRM
  - В модалке лида добавлена секция "Калькулятор / Тех. задание"
  - Автоматическая привязка заказа из калькулятора при синхронизации из amoCRM (по amocrm_id)
  - Ручная привязка заказа из калькулятора по ID
  - Отображение привязанного заказа: модель, клиент, сумма, дата
  - Кнопка "Открыть в калькуляторе" — переход к редактированию заказа
  - Кнопка "Тех. задание" — открывает TechSpecModal с данными заказа (модели, опции)
  - Если заказ не привязан — поле для ввода ID и кнопка "Привязать"
- **Backend**: `GET /api/sauna-crm/leads/{id}/calculator-order`, `POST /api/sauna-crm/leads/{id}/link-calculator-order`
- **Frontend**: Секция в SaunaCRMPage.jsx + TechSpecModal
- **Testing**: Backend 10/10, Frontend 100%

### Mar 17, 2026 - FEATURE: Sales Dashboard (COMPLETED)
- **NEW FEATURE**: Complete Sales Dashboard accessible from Sauna section tab (admin-only)

### Mar 18, 2026 - FEATURE: Mini CRM для саун (COMPLETED)
- **NEW FEATURE**: Полноценная мини-CRM в разделе Sauna
  - Производственный календарь: месячный вид, заказы привязаны по дате готовности, панель заказов справа при выборе даты
  - Канбан-доска: настраиваемые этапы с цветами, карточки заказов
  - Список: все заказы с поиском, badge'ами этапов и суммами
  - Карточка клиента: контакт, 10 настраиваемых полей, даты (производство/готовность/доставка), заметки
  - Документы: загрузка КП/Договор/Счёт в Cloudinary, отправка ссылки в amoCRM
  - Настройки: поля (вкл/выкл, тип, маппинг amoCRM), этапы (цвет, Pipeline/Stage ID), обратная синхронизация
  - amoCRM: импорт лидов по этапам, обновление этапа лида при перемещении, push полей обратно
  - Двусторонняя связь: ручная синхронизация "В amoCRM" для push, "Синхронизировать" для pull
- **Backend**: `/app/backend/routes/sauna_crm.py` - leads CRUD, documents, calendar, settings, amoCRM sync
- **Frontend**: `/app/frontend/src/components/SaunaCRMPage.jsx` + CRM tab in Header
- **Testing**: Backend 10/10, Frontend 100%

### Mar 17, 2026 - BUGFIX: PDF ссылка в amoCRM
- Убран вызов `/mark-quote-created` (отправлял заметку без ссылки)
- Теперь отправляется одна заметка из `upload-calculator-pdf` со ссылкой Cloudinary

### Mar 17, 2026 - FEATURE: Довозы в Складе (COMPLETED)
- **NEW FEATURE**: Раздел "Довозы" (Additional Deliveries) в Складе для теплиц
  - 3 этапа канбан-доски: Довоз принят → Довоз отправлен → Довоз доставлен
  - Drag & drop между этапами с автоматической синхронизацией с amoCRM
  - При перемещении в "Отправлен"/"Доставлен" — автоматическая смена status_id лида в amoCRM
  - Кнопка "Синхронизировать с amoCRM" — импорт лидов из настроенного этапа воронки
  - История изменений для каждого заказа
  - Настройки: выбор воронки, этапа-источника, целевых этапов для "отправлен" и "доставлен"
  - Поддержка как dropdown-выбора воронок (загрузка из amoCRM API), так и ручного ввода ID
- **NEW FEATURE**: Настройки Склада
  - Toggle-переключатели для включения/отключения секций: Заказы (Канбан), Рейсы, Довозы
  - Настройки amoCRM-интеграции для довозов (pipeline_id, source/sent/delivered status_id)
- **Backend**: `/app/backend/routes/dovoz.py` - CRUD, settings, amoCRM sync, stats, history
- **Frontend**: `/app/frontend/src/components/WarehousePage.jsx` - полностью переписан с вкладками и настройками
- **Testing**: Backend 11/11 (100%), Frontend 100% все фичи верифицированы
  - Navigation: "Sprzedaż" tab in Sauna section header (admin-only, data-testid="sales-tab-btn")
  - Removed standalone card from landing page, moved into Sauna section as a tab
  - Summary cards: total orders, total amount, paid amount, remaining
  - Full CRUD: create/edit/delete sales records via dialogs
  - Filters: date range, manager dropdown, status dropdown
  - Bonus calculation dialog: date range selection, per-manager bonus calculation
  - Manager percentage settings: add/remove managers with custom bonus percentages
  - Excel import: upload .xlsx files with Russian column mapping
  - Statistics endpoint: aggregated stats by manager and status
- **BUGS FIXED**:
  - Backend import error: `from config import get_database` → `from database import db`
  - Blank page: Added sales rendering in sauna section routing block in App.js
  - SelectItem empty value: Changed `value=""` to `value="all"` pattern for Shadcn compatibility
  - 307 redirect: Removed trailing slashes from sub-route API calls
  - Duplicate `)}` artifact on landing page after removing sales card
- **Backend**: `/app/backend/routes/sales.py` - CRUD, managers, bonus-calculation, import-excel, statistics
- **Frontend**: `/app/frontend/src/components/SalesPage.jsx` - complete UI
- **Header**: `/app/frontend/src/components/Header.jsx` - added Sprzedaż tab (desktop + mobile, admin-only)
- **Testing**: Backend 100% (14/14), Frontend all flows verified


### Feb 23, 2026 - FEATURE: Clone Layout to Another Model (COMPLETED)
- **NEW FEATURE**: Added ability to clone layouts to different sauna models with auto-scaling
  - Backend endpoint: `POST /api/layout-configurator/layouts/{layout_id}/clone`
  - Frontend: Clone button (blue CopyPlus icon) added to layout list in admin mode
  - Auto-scaling: Automatically calculates scale factors based on model dimensions (e.g., 200cm → 250cm = 1.25x scale)
  - Manual scaling: Option to disable auto-scale and set custom scaleX/scaleY values
  - Scaled properties: element positions (left, top), room dimensions (width, height, CM dimensions)
- **Files changed**:
  - `/app/backend/routes/layout_configurator.py` - Added clone endpoint with scaling logic
  - `/app/frontend/src/components/LayoutConfiguratorPage.jsx` - Added clone dialog, button, and handlers
- **Testing**: API tested via curl - successfully cloned 200cm layout to 250cm with 1.25x scaling

### Feb 23, 2026 - BUG FIX: Variant Model Filtering (COMPLETED)
- **BUG FIX**: Elements "flying apart" when auto-applying variants from calculator
  - **Root Cause**: Variants from one sauna model (e.g., 3.5m) were incorrectly applied to another model (e.g., 2m) because filtering only checked calculator option match, not modelId/variantId
  - **Solution**: Added `isOptionForCurrentContext()` helper function that filters variants by:
    1. `option.modelId` must match `selectedModel.id` (or be null for global)
    2. `option.variantId` must match `selectedVariant.id` (or be null for all submodels)
  - Applied filtering to both auto-apply useEffect and `applyAllCalculatorVariants` function
  - Also added `fetchLayoutOptions(initialModelId, initialVariantId)` call in initialModelId useEffect
- **Files changed**:
  - `/app/frontend/src/components/LayoutConfiguratorPage.jsx` - lines 344-450, 1196-1280
- **Testing**: 100% (5/5 tests passed - variant filtering by modelId/variantId verified)

### Feb 23, 2026 - Phase 2: Extended Configurator Integration (COMPLETED)
- **NEW FEATURE**: "Planowki" menu link for direct configurator access
  - Added to top navigation menu (data-testid="layout-configurator-menu-btn")
  - Opens full-screen configurator where manager can select model themselves
  - Accessible to all users (not just from calculator modal)
- **NEW FEATURE**: Calculator-to-Configurator option mapping
  - New `calculatorMapping` field on variants: `{categoryId, optionId}`
  - Admin can link variant to specific calculator option in edit dialog
  - When opening configurator from calculator, matching variants auto-apply
  - New API endpoint: `GET /api/layout-configurator/calculator-categories`
- **NEW FEATURE**: Save layout to order
  - New fields in order model: `layoutConfigImage`, `layoutConfigJson`, `layoutConfigVariants`
  - New API endpoint: `PUT /api/sauna/orders/{id}/layout-config`
  - Saves PNG image + JSON canvas state for later editing
  - "В заказ" button appears when `orderId` is provided
- **Files changed**:
  - `/app/frontend/src/components/Header.jsx` - added Planowki button
  - `/app/frontend/src/App.js` - added layout-configurator tab routing
  - `/app/backend/routes/layout_configurator.py` - calculator-categories endpoint, calculatorMapping field
  - `/app/backend/routes/sauna_orders.py` - layout-config endpoints
  - `/app/backend/models/sauna.py` - layout config fields in order model
- **Testing**: 80% (4/5 features verified, calculator mapping UI exists in code)

### Feb 23, 2026 - Layout Configurator Integration with Sauna Calculator (COMPLETED)
- **NEW FEATURE**: Layout Configurator accessible from Sauna Calculator
  - New "Konfigurator planowek" section appears after selecting a sauna model
  - Green button "Otwórz konfigurator" opens full configurator in modal window
  - Model and variant from calculator are automatically pre-selected in configurator
  - Configurator receives props: `isAdminMode`, `initialModelId`, `initialVariantId`
- **ADMIN-ONLY CONTROLS**: Hidden for non-admin users
  - "+ Nowa opcja" (Create new option) - hidden for managers
  - "Zapisz jako wariant" (Save as variant) - hidden for managers  
  - "Kopiuj opcje do innego modelu" (Copy options) - hidden for managers
  - "Pokaż ukryte warianty" (Show hidden variants) - hidden for managers
  - Edit/delete buttons on options and variants - hidden for managers
  - Managers can only VIEW and APPLY variants, not edit them
- **Files changed**:
  - `/app/frontend/src/components/SaunaCalculator.jsx` - added button, modal, lazy-load
  - `/app/frontend/src/components/LayoutConfiguratorPage.jsx` - added isAdminMode prop checks
- **Testing**: 100% (5/5 frontend features verified)

### Feb 22, 2026 - Edit Variants + Larger Canvas (COMPLETED)
- **NEW FEATURE**: Edit existing variants
  - Yellow pencil icon on each variant
  - Dialog shows: name (PL/RU), list of element configurations
  - "Dodaj/aktualizuj z canvasu" button - select element on canvas, click to update its position in variant
  - Can remove individual element configs
  - Saves updated element positions via PUT /api/layout-configurator/options/{id}/variants/{id}
- **UI IMPROVEMENT**: Increased canvas and panels height
  - Changed from `calc(100vh-200px)` to `calc(100vh-120px)` - 80px more space
  - Elements card min-height increased from 400px to 500px
  - Less scrolling needed

### Feb 22, 2026 - Edit Options Feature (COMPLETED)
- **NEW FEATURE**: Edit existing options
  - Yellow pencil icon button on each option header
  - Dialog to edit option name (PL + RU)
  - Uses existing PUT /api/layout-configurator/options/{id} endpoint
  - No need to delete and recreate options anymore
- **Testing**: API verified, frontend lint passed

### Feb 22, 2026 - Bug Fix: Hidden Elements + Copy All Options (COMPLETED)
- **BUG FIX**: Hidden elements can now be selected again
  - Changed from `visible=false` to `isHidden` flag with `opacity=0.25`
  - Hidden elements remain selectable (`selectable=true`, `evented=true`)
  - User can click on hidden element and toggle visibility back on
- **IMPROVEMENT**: Copy ALL options at once
  - New "Wszystkie opcje" option in copy dialog
  - Shows total count: "(X opcji, Y wariantów)"
  - Copies ALL options with their variants to target model
- **Testing**: 100% (6/6 frontend features verified)

### Feb 22, 2026 - Bug Fix: Template Loading + Copy Options Feature (COMPLETED)
- **BUG FIX**: Templates not switching when changing models
  - Root cause: Race condition - `loadTemplateForModel` used state `layouts` before it was updated by `fetchLayouts`
  - Solution: New `loadTemplateForModelFromAPI` function fetches layouts directly from API
  - Now `handleModelChange` and `handleVariantChange` properly load templates immediately
- **NEW FEATURE**: Copy option with variants to another model
  - Button "Kopiuj opcję do innego modelu" on each option card
  - Dialog to select: source option, target model, optional target variant
  - Copies option name (PL+RU), all variants with configurations and conditions
  - Info panel explains what gets copied
  - Use case: Created variants for 2m sauna → copy to 3m sauna → adjust positions
- **BUG FIX**: SelectItem empty value error (fixed by testing agent)
  - Changed `value=""` to `value="all"` in target variant selector
- **Testing**: 100% (6/6 frontend features verified)

### Feb 22, 2026 - Model-Specific Layouts & Variants + Element Visibility (COMPLETED)
- **NEW FEATURE**: Model/Variant-specific layouts and configuration options
  - Layouts and Options are now bound to specific sauna models and submodels (variants)
  - Backend API supports filtering by `modelId` and `variantId` query parameters:
    - `GET /api/layout-configurator/layouts?modelId=xxx&variantId=yyy`
    - `GET /api/layout-configurator/options?modelId=xxx&variantId=yyy`
  - Frontend automatically reloads layouts/options when model or variant selection changes
  - UI shows filter status: "Planowki dla: [Model] / [Variant]"
  - Warning message shown when no model is selected: "Wybierz model, żeby zobaczyć..."
  - Clear filter button (X) to show all layouts/options
- **NEW FEATURE**: Model-specific element filtering in asset library
  - Elements (assets) library now filters by selected model
  - Shows global elements (modelId=null) + model-specific elements
  - Model-specific elements marked with "MODEL" badge (blue ring)
  - Tooltip shows whether element is global or model-specific
  - Info message: "Elementy dla: [Model] + globalne"
- **NEW FEATURE**: Element visibility toggle in Layout Configurator
  - "Widoczność elementu" switch in properties panel (Polish: "Widoczność elementu")
  - Hidden elements shown with 30% opacity (selectable but semi-transparent)
  - Warning text when element is hidden: "Element jest ukryty (półprzezroczysty)"
  - Visibility state saved in variant configurations (visible: true/false)
  - `applyVariant()` function applies visibility changes when variant is selected
- **Use case**: Manager selects model "Sauna 2.5m" → submodel "Standard" → sees only layouts/options for that configuration → can hide table element in one variant and show it in another
- **Testing**: 100% (13/13 backend tests, all frontend features verified)

### Feb 22, 2026 - Layout Options & Variants System (COMPLETED)
- **NEW FEATURE**: Configuration variants system for layouts
  - Global **Options** (e.g., "Strona wejścia", "Typ ławek") group related variants
  - **Variants** store element positions, rotation, scale for quick application
  - Left panel has new "Варианты" tab with:
    - "Nowa opcja" button to create configuration options
    - "Zapisz jako wariant" button (when element selected) to save current position
    - List of options with their variants, click to apply
  - `applyVariant()` function moves/transforms elements to saved positions
  - Backend API: full CRUD for options and variants
    - `GET/POST /api/layout-configurator/options`
    - `PUT/DELETE /api/layout-configurator/options/{id}`
    - `POST /api/layout-configurator/options/{id}/variants`
    - `PUT/DELETE /api/layout-configurator/options/{id}/variants/{variantId}`
- **Use case**: Create "Strona wejścia" option → Add door element → Position it for "Wejście proste" → Save variant → Reposition for "Wejście boczne" → Save variant. Now click variants to instantly reposition door.
- **Testing**: 100% (14/14 backend tests, all frontend features verified)

### Feb 22, 2026 - Individual Wall Thickness & Fixed Height Elements (COMPLETED)
- **NEW FEATURE**: Individual wall thickness for rooms in Layout Configurator
  - Add Room dialog now shows 4 separate input fields: Левая (Left), Правая (Right), Верхняя (Top), Нижняя (Bottom)
  - Inner dimensions auto-calculate based on all 4 wall thicknesses
  - Example: Outer 200×150 with walls 8, 4, 10, 5 = Inner 188×135 cm
  - Room group stores `wallLeftCm`, `wallRightCm`, `wallTopCm`, `wallBottomCm` properties
  - Backward compatible with old `wallThicknessCm` single value
- **NEW FEATURE**: Fixed height elements (benches)
  - New checkbox "Фиксированная высота" in Upload Asset dialog
  - When enabled, element can only be scaled horizontally (width changes, height stays fixed)
  - Uses `lockScalingY: true` and custom control visibility
  - Backend stores `fixedHeight: boolean` in asset document
- **NEW FEATURE**: Room wall thickness editing in Properties panel (Polish UI)
  - "Grubość ścian (cm)" section with 4 fields: Lewa, Prawa, Górna, Dolna
  - Changes update dimension labels in real-time
- **NEW FEATURE**: Room dimension visibility toggles
  - "Widoczność wymiarów" section with 2 switches:
    - "zewn. (zewnętrzne)" - toggle outer dimensions
    - "wewn. (wewnętrzne)" - toggle inner dimensions
- **CHANGE**: Polish dimension labels on canvas
  - "zewn:" instead of "внеш:" for outer dimensions
  - "wewn:" instead of "внутр:" for inner dimensions
- **BUGFIX**: Dimension lines (red distance markers) now remain draggable when Select tool is active
- **BUGFIX**: Rotation dimension labels now swap correctly when element rotated 90°/270°
- **REFACTORING**: Created modular structure for Layout Configurator
  - New folder: `/app/frontend/src/components/layout-configurator/`
  - Constants, hooks, and dialog components extracted
- **Testing**: 100% pass rate

### Feb 20, 2026 - Change Responsible User Feature (COMPLETED)
- **NEW FEATURE**: Admins can now reassign orders to different employees
  - Added dropdown in `createdBy` column showing current responsible user
  - Clicking opens list of admin/employee users
  - Selecting a new user immediately updates the order
  - Change is tracked in order history (`changeHistory` array)
  - Works for both Sauna and Balia orders
- **Backend Endpoints Added**:
  - `PATCH /api/sauna/orders/{order_id}/assign` - Reassign sauna order
  - `PATCH /api/orders/{order_id}/assign` - Reassign balia order
- **Frontend Components**:
  - New: `/app/frontend/src/components/orders/AssignUserDropdown.jsx`
  - Updated: `OrdersPage.jsx` - Shows dropdown for admins
  - Updated: `AdminOrdersPage.jsx` - Added "Ответственный" column with dropdown
- **Bug Fixed**: `AssignUserDropdown` used wrong localStorage key (`token` instead of `authToken`)
- **Testing**: All 8 backend tests passed, frontend verified

### Feb 20, 2025 - Order Management & amoCRM Widget Updates (COMPLETED)
1. **Calculator Option Controls** (Updated):
   - Added gift toggle (🎁) and remove (🗑️) buttons in SelectedOptionsList (right panel)
   - **Now available for managers AND admins** (not just admins)
   - **Foundation (Koszt fundamentu)** can now be made a gift - shown with controls
   - **Delivery (Dostawa)** shown as separate line, not included in subtotal
     - Delivery added to total AFTER discount is applied
     - Delivery can be made a gift or removed
     - Shows in PDF with other options
   - Works in both SaunaCalculator.jsx and SaunaCalculatorNew.jsx
   - Files Modified:
     - `/app/frontend/src/components/sauna/useSaunaCalculator.js`:
       - Added `canGiveGifts` (true for admin OR manager)
       - Added `calculateDeliveryPrice()` - calculates delivery separately
       - `calculateOptionsTotal()` excludes 'dostawa' category
       - `calculateFoundationPrice()` respects gift status
       - `calculateTotal()` = subtotal - discount + delivery
     - `/app/frontend/src/components/SaunaCalculatorNew.jsx` - Updated SummaryCard with delivery line
     - `/app/frontend/src/components/SaunaCalculator.jsx` - Same updates

2. **Orders Page Cleanup**:
   - Removed Quick Edit button (pencil icon) - gifts/options now managed in calculator
   - Removed separate "Подарки" button - all editing done through calculator

3. **amoCRM Widget - Multiple Orders Support**:
   - Updated `/api/widget/preview/{lead_id}` to show ALL orders for a deal (sauna + balia + greenhouse)
   - Each order type now has separate "Edit" and "View" buttons
   - Removed "Edit Gifts" standalone page link (gifts managed through main calculator edit)
   - New endpoint `/api/widget/orders-status/{lead_id}` returns all orders for a lead

4. **amoCRM Widget JS Updates**:
   - Widget now loads existing orders and shows them with edit/view buttons
   - Shows section for each order type (sauna, balia, greenhouse) if exists
   - Each order has its own edit/view buttons that open correct calculator
   - Files Modified:
     - `/app/backend/routes/widget.py` - Added `get_orders_dict_by_amocrm_id()`, updated `preview_order()`, added `orders-status` endpoint
     - `/app/amocrm-widget/script.js` - Updated `renderCalculatorSelector()`, added `openOrderEdit()`, `openOrderView()`
     - `/app/amocrm-widget/style.css` - Added styles for order items and action buttons

### Feb 20, 2025 - Sauna Calculator Foundation Price Bug Fix (COMPLETED)
- **BUGFIX**: Fixed double-counting of foundation price ("Belki podłużne") in PDF generation
  - Problem: When "Dodaj do sauny Belki podłużne" option was selected, its price (150 PLN) appeared twice in PDF:
    1. In the options list (from `selectedOptions`)
    2. As a separate `foundationPrice` value in the total
  - Solution: Added checks to skip `fundament` category in all PDF generation loops
  - Files Modified: `/app/backend/routes/sauna.py` (4 locations)
    - Line ~204: Skip in main selectedOptions loop
    - Line ~290: Skip in selections fallback loop
    - Line ~1093: Skip in options_items selectedOptions loop
    - Line ~1126: Skip in options_items selections fallback loop
- **Testing**: Manual verification passed

### Feb 19, 2025 - Layout Configurator Select All, Duplicate, Snap & Align (COMPLETED)
- **NEW**: Select All (Ctrl+A)
  - Selects all objects on canvas (excluding grid and labels)
  - Shows toast with count of selected objects
- **NEW**: Duplicate (Ctrl+D or "Дубль" button)
  - Duplicates selected object(s) with 30px offset
  - Works with single objects and groups
- **NEW**: Snap to Objects and Walls
  - "Привязка" toggle button in toolbar
  - Objects snap to canvas edges (walls)
  - Objects snap to edges and centers of other objects
  - Snap distance: 10px
- **NEW**: Alignment Tools
  - "Выровнять" dropdown with 6 options:
    - Left, Center (horizontal), Right
    - Top, Center (vertical), Bottom
  - Works with multiple selected objects
- **NEW**: Distribution Tools
  - "Распред." dropdown with horizontal/vertical options
  - Evenly distributes 3+ objects
- **Files Modified**:
  - `/app/frontend/src/components/LayoutConfiguratorPage.jsx` - Added selectAll, duplicateSelected, alignObjects, distributeObjects, getSnapPoints, applySnap functions
- **Testing**: 100% success (all features verified)

### Feb 19, 2025 - Layout Configurator Group/Copy/Paste & Refactoring (COMPLETED)
- **NEW**: Group/Ungroup Objects
  - Select multiple objects with Shift+Click
  - Ctrl+G or "Группа" button to group
  - Ctrl+Shift+G or "Разбить" button to ungroup
  - Groups move, scale, rotate as one unit
- **NEW**: Copy/Paste
  - Ctrl+C or copy button to copy selected object(s)
  - Ctrl+V or "Вставить" button to paste with 20px offset
  - Multiple pastes continue offsetting
  - Works with single objects and groups
- **REFACTORED**: Extracted hooks
  - `useCanvasHistory.js` - undo/redo history management
  - `useClipboard.js` - copy/paste/group/ungroup logic
  - `useKeyboardShortcuts.js` - all keyboard shortcuts
- **Files Created/Modified**:
  - `/app/frontend/src/components/LayoutConfiguratorPage.jsx` - Main component
  - `/app/frontend/src/components/layout-configurator/useClipboard.js` - Clipboard hook
  - `/app/frontend/src/components/layout-configurator/useKeyboardShortcuts.js` - Shortcuts hook
  - `/app/frontend/src/components/layout-configurator/useCanvasHistory.js` - History hook
- **Testing**: 100% success (all features verified)

### Feb 19, 2025 - Layout Configurator P0 & P1 Features (COMPLETED)
- **NEW**: Text Tool
  - Click canvas with Text tool (T key) opens dialog
  - Enter text, choose font size (8-72), color picker
  - Text added to canvas as editable Fabric.js object
- **NEW**: Per-Element Dimension Toggle
  - "Показать размеры" switch in properties panel for each selected object
  - Toggle visibility of dimension labels for individual elements
  - Setting saved with layout
- **NEW**: Keyboard Shortcuts
  - `Ctrl+Z` - Undo last action
  - `Delete`/`Backspace` - Delete selected object
  - `Escape` - Deselect object, switch to select tool
  - `V` - Select tool
  - `R` - Rectangle tool
  - `L` - Line/Wall tool
  - `M` - Ruler/Measurement tool
  - `T` - Text tool
  - Shortcuts displayed in toolbar hints
- **NEW**: Catalog Integration
  - Published layouts now appear in SaunaCalculator's LayoutCatalog
  - `/api/layout-configurator/published-layouts` endpoint returns layouts for catalog
  - `useLayoutCatalog.js` fetches from both FAQ and Configurator sources
  - Export layout image when publishing
- **REFACTORED**: Component Modularization
  - Created `/app/frontend/src/components/layout-configurator/` folder
  - New components: `DrawingToolbar.jsx`, `PropertiesPanel.jsx`, `SettingsPanel.jsx`, `ElementsLibrary.jsx`
  - Shared constants in `constants.js`
  - Index file for easy imports
- **Files Created/Modified**:
  - `/app/frontend/src/components/LayoutConfiguratorPage.jsx` - Main component
  - `/app/frontend/src/components/layout-configurator/*` - Refactored components
  - `/app/frontend/src/components/sauna/useLayoutCatalog.js` - Catalog integration
- **Testing**: All 17 API tests pass (100%), all UI features verified

### Feb 18, 2025 - Layout Configurator UI Improvements & Distance Lines (COMPLETED)
- **NEW**: Distance indicator lines between objects
  - Red dashed lines with arrows show distances between objects
  - Distances shown between aligned objects (horizontal and vertical)
  - Distances from each object to room walls (all 4 directions)
  - Labels with distance values in centimeters
- **IMPROVED**: Reorganized UI layout
  - Settings panel moved to left sidebar (model selector, grid, zoom, dimensions toggle)
  - Canvas area is now clean and centered
  - Drawing tools in compact toolbar above canvas
  - Removed canvas size inputs (using standard canvas)
- **Files Modified**: `/app/frontend/src/components/LayoutConfiguratorPage.jsx`
- **Testing**: Visual verification passed

### Feb 18, 2025 - Layout Configurator Bug Fixes (COMPLETED)
- **FIXED**: Drawing line over rectangle was moving the rectangle
  - Objects are now made non-interactive during drawing
  - Interactivity restored after mouse up
- **FIXED**: No manual input for shape dimensions  
  - Added INPUT fields for width/height (rectangles) and length (lines) in properties panel
  - Values editable in centimeters
- **FIXED**: Grid step was 10cm, user needed 1cm option
  - Added 1 cm option to grid selector dropdown
- **NEW**: Dimensions displayed directly on canvas
  - Labels show width/height on rectangles (e.g., "150 см")
  - Labels show length on lines
  - Toggle button "Размеры" to show/hide dimension labels
  - Distance indicators from objects to room walls
- **Files Modified**: `/app/frontend/src/components/LayoutConfiguratorPage.jsx`
- **Testing**: All 7 test scenarios passed (100% success rate)

### Feb 18, 2025 - Layout Configurator (NEW FEATURE - IN PROGRESS)
- **NEW**: Modular sauna layout configurator with drag & drop canvas
- **Features Implemented**:
  - Fabric.js canvas with grid snap (configurable: 1cm, 5cm, 10cm, 20cm, 25cm, 50cm)
  - Upload graphic elements (PNG/SVG) to library
  - Element types: heater, bench, door, window, shower, divider, stairs, terrace, other
  - Drag elements from library to canvas
  - Element manipulation: move, rotate (±15°/90°), scale (10%-300%)
  - Properties panel showing x, y, rotation, scale with CM conversion
  - Save/load layouts to MongoDB
  - Export canvas to PNG
  - Publish layouts to calculator catalog
  - **Variant selection** - supports sub-models for different layouts
  - **Outline/contour upload** - upload background image with real dimensions
  - **Dimension display** - shows sizes in cm based on outline scale
  - **Duplicate layouts** - copy existing layouts for quick variations
  - **Drawing Tools:**
    - Select tool (cursor) - select and move objects
    - Rectangle tool - draw rectangles by dragging (for sauna outline, zones)
    - Wall/Line tool - draw walls and dividers
    - Color picker for stroke
    - Line width selector in cm
    - Fill toggle for rectangles
    - All shapes snap to 1cm precision
    - Real-time dimension display on canvas
    - Manual dimension input in properties panel
    - Edit stroke color and width after drawing
  - **Dimension Labels on Canvas:**
    - Width/height labels on rectangles
    - Length labels on lines  
    - Toggle visibility with "Размеры" button
- **Backend API**: `/api/layout-configurator/` with endpoints:
  - `GET /element-types` - available element types
  - `POST /assets` - upload graphic element
  - `GET /assets` - list elements
  - `DELETE /assets/{id}` - delete element
  - `POST /layouts` - create layout
  - `GET /layouts` - list layouts
  - `GET /layouts/{id}` - get layout
  - `PUT /layouts/{id}/data` - update layout
  - `DELETE /layouts/{id}` - delete layout
  - `POST /layouts/{id}/duplicate` - duplicate layout
  - `POST /layouts/{id}/publish` - publish to catalog
  - `GET /published-layouts` - get published for calculator
  - `GET /sauna-models` - sauna models WITH VARIANTS for dropdown
  - **Outline endpoints:**
    - `POST /outlines` - upload outline with dimensions
    - `GET /outlines` - list all outlines
    - `GET /outlines/{model_id}` - get outline for model/variant
    - `DELETE /outlines/{outline_id}` - delete outline
- **Frontend**: New tab "Планировки" in AdminPanel
- **Files Created/Modified**:
  - `/app/backend/routes/layout_configurator.py` - full backend API
  - `/app/frontend/src/components/LayoutConfiguratorPage.jsx` - full UI
- **Status**: Core functionality complete with bug fixes applied
- **TODO**: 
  - Integrate published layouts with existing LayoutCatalog component

### Feb 18, 2025 - Content Generator 500 Error Fix (COMPLETED)
- **FIXED**: 500 Internal Server Error on `/api/content/processed-images` endpoint
- **Root Cause**: MongoDB Motor async cursor was being iterated synchronously
- **Fix**: Added `await` to all MongoDB operations and used `to_list()` for cursor iteration
- **Files Modified**: `/app/backend/routes/content_generator.py`

### Feb 18, 2025 - Cloudinary URL Fix (COMPLETED)
- **FIXED**: Images not loading due to malformed URLs
- **Root Cause**: Frontend was prepending API_URL to already absolute Cloudinary URLs
- **Fix**: Added `url.startsWith('http')` check before prepending API_URL
- **Files Modified**: `/app/frontend/src/components/ContentGeneratorPage.jsx`

### Feb 12, 2025 - amoCRM Batch API Optimization & Section Delete Buttons (COMPLETED)
- **OPTIMIZED**: amoCRM sync now uses batch API instead of N+1 individual requests
  - `refresh_all_orders` - fetches all leads in batches of 50 (was: 1 request per lead)
  - `sync_missing_orders` - fetches all leads in batches of 50 (was: 1 request per lead)
  - New function `fetch_leads_batch_from_amocrm()` for efficient batch fetching
  - Performance: N/50 API requests instead of N requests
- **NEW**: Delete buttons for Balia/Sauna sections in Logistics Settings
  - "Удалить все из Купелей" - deletes all amoCRM orders from Balia
  - "Удалить все из Саун" - deletes all amoCRM orders from Sauna
  - Confirmation dialog before deletion
- **Files Modified**:
  - `routes/amocrm.py` - Added batch fetch, refactored refresh_all and sync_missing
  - `logistics/useLogistics.js` - Added `deleteAllOrdersInSection` function
  - `LogisticsPage.jsx` - Added delete section buttons in settings

### Feb 9, 2025 - Performance Optimization & Cloudinary Integration (COMPLETED)
- **OPTIMIZED**: Added GZip compression middleware - 81% reduction in API response size
- **OPTIMIZED**: Added MongoDB indexes for faster queries (orders, users, settings, leads)
- **OPTIMIZED**: Backup scheduler now waits 5 minutes after startup (prevents blocking)
- **OPTIMIZED**: Backup skips imgur.com images (rate limited) and old preview URLs
- **NEW**: Cloudinary integration for external image storage (optional)
  - Auto-fallback to MongoDB if Cloudinary not configured
  - New endpoint: `/api/upload/storage-status`
  - New endpoint: `/api/cloudinary/signature` for signed uploads
- **FIXED**: .gitignore malformed entries cleaned up
- **FIXED**: CORS set to "*" for Emergent deployment compatibility
- **Files Modified**:
  - `server.py` - GZip middleware, MongoDB indexes, backup delay
  - `routes/upload.py` - Cloudinary support with MongoDB fallback
  - `routes/backup.py` - Skip imgur/old preview URLs, add delays
  - `services/cloudinary_service.py` - New service for Cloudinary API
  - `services/cache_service.py` - New in-memory cache service
  - `backend/.env` - Cloudinary config placeholders added

### Feb 9, 2025 - Deployment Fixes (COMPLETED)
- **FIXED**: Unstable login sessions - added locking to prevent race conditions in init_admin_user
- **FIXED**: Better error handling in auth service with logging
- **Files Modified**: `services/auth_service.py`, `routes/auth.py`

### Feb 5, 2025 - Hot Tub (Balia) 422 Error Fix - CREATING NEW OPTIONS (COMPLETED)
- **FIXED**: 422 error when creating NEW options in hot tub pricing admin
- **Root Cause**: `CategoryOption.name` and `BaliaCategory.name` were required (`str`), but frontend only sends `nameRu`/`namePl`
- **Fix**: Made `name` and `inputType` fields `Optional` with defaults in Pydantic models
- **Tested**: Adding new option → Save all → 200 OK, toast "Zapisano!" appears
- **Files Modified**: `/app/backend/models/balia.py` - CategoryOption.name, BaliaCategory.name, BaliaCategory.inputType now Optional

### Feb 2, 2025 - Custom Layout Upload in Calculator (COMPLETED)
- **NEW**: Managers can now upload their own custom layout image directly in "Katalog planowek" (Layout Catalog)
- **Feature**: Upload button "Wgraj własną planowkę" appears after selecting a size
- **Feature**: Custom uploaded image has highest priority and overrides catalog/variant images
- **Feature**: Custom image preview shows with blue styling and checkmark
- **Feature**: "Własna planowka" badge appears in Layout Catalog header when custom image is uploaded
- **Feature**: Remove button allows deleting the custom image to return to catalog selection
- **PDF**: Custom uploaded image is used on page 1 of generated PDF (in "WYMIARY POMIESZCZEŃ" section)
- **Backend**: Uses existing `/api/upload/image` endpoint with MongoDB storage
- **Files Modified**:
  - `LayoutCatalog.jsx` - Added upload UI, preview, remove functionality
  - `useLayoutCatalog.js` - Added `uploadCustomLayoutImage`, `removeCustomLayoutImage`, `customLayoutImage` state
  - `useSaunaCalculator.js` - Added priority logic: Custom Image > Catalog > Category > Variant
  - `SaunaCalculator.jsx` - Passes new props to LayoutCatalog
- **Testing**: All 10 backend tests passed, UI fully functional

### Feb 1, 2025 - Layout Selection Persistence & PDF Improvements (COMPLETED)
- **NEW**: Layout selection (from catalog) now saved in order (`selectedLayoutId`, `selectedLayoutSize`)
- **NEW**: Layout selection restored when editing existing order
- **FIX**: PDF from Orders page now includes full page 2 with all options (was missing before)
- **FIX**: PDF uploaded to amoCRM now includes full page 2 (widget.py updated)
- **NEW**: PDF page 2 - small categories (1-3 options) now display in two columns for compact layout
- **Backend**: `sauna.py` Section 3 rewritten with `build_category_block()` for two-column layout
- **Backend**: `widget.py` `generate_and_upload_pdf_to_amocrm()` now collects all page 2 data
- **Frontend**: `useSaunaCalculator.js` - added layout fields to `orderData`, restore via `handleLayoutSelect`
- **Frontend**: `OrdersPage.jsx` - `handleDownloadPDF` now fetches all data for page 2
- **Testing**: All tests passed (26/26 backend + UI flows)

### Feb 1, 2025 - Code Refactoring: Backend & Frontend Modularization (COMPLETED)
- **Backend Refactoring**:
  - `sauna.py` reduced from 2842 to 2318 lines (-18%)
  - Created modular files: `sauna_crud.py`, `sauna_orders.py`, `sauna_wizard.py`
  - Created PDF helpers: `pdf_helpers.py`, `pdf_sections.py`
  - All modules connected via `router.include_router()`
- **Frontend Refactoring**:
  - `useSaunaCalculator.js` reduced from 1237 to 1134 lines (-8%)
  - Created modular hooks: `useLayoutCatalog.js`, `useOptionVisibility.js`, `usePriceCalculation.js`
  - Hooks integrated and working
- **Testing**: All 22 backend tests passed, UI fully functional
- **Documentation**: Updated `/app/REFACTORING_GUIDE.md`

### Jan 30, 2025 - Sub-model Description in PDF & Room Sizes from Variant (COMPLETED)
- **NEW**: Variant description (hint) now displayed in PDF's "WYMIARY POMIESZCZEŃ" section as "Co zawiera wariant:"
- **FIX**: Removed duplicate variant description in PDF (was appearing twice)
- **NEW**: Calculator variant cards now show room dimension badges:
  - 👥 capacity, 🌿 terraceSize, 🛋️ relaxRoomSize, 🔥 steamRoomSize, 🚪 entranceSide
- **NEW**: Calculator summary card shows all room dimensions from selected sub-model
- **REMOVED**: Old "Размеры комнат (стандарт)" and "Размеры с доп. террасой" blocks from model editor
- **Backend**: Updated `sauna.py` PDF generation - fixed duplicate hint, proper formatting
- **Frontend**: Updated `useSaunaCalculator.js` - `getRoomSizes()` now prioritizes variant data
- **Frontend**: Updated `SaunaCalculator.jsx` - SummaryCard shows all variant fields, variant cards show dimension badges
- **Frontend**: Updated `ModelDialog.jsx` - removed deprecated room size sections
- **Tested**: PDF generation (curl test), UI screenshots confirmed

### Jan 30, 2025 - FAQ Layout Variants Section & Model Gallery Images (COMPLETED)
- **NEW**: Added "Варианты планировок" (Layout Variants) category to sauna FAQ
- **NEW**: Structured layout variants with grouping by model size (2m, 2.5m, 3m, etc.)
- **Feature**: Each model size expands to show all available layout variants
- **Feature**: Each variant has: name, image, room sizes (terrace, relax room, steam room), entrance type, description
- **Feature**: Color-coded room size badges (green=terrace, blue=relax, orange=steam, purple=entrance)
- **Feature**: Admin can add/edit/delete layout variants via dialog with image upload
- **NEW**: Backend API for layout variants (`/api/faq/layout-variants`, `/api/faq/layout-variants/grouped`)
- **NEW**: MongoDB collection `sauna_layout_variants` for structured storage
- **Backend**: Added `SaunaLayoutVariant` model in `sauna.py`
- **Backend**: CRUD endpoints in `faq.py` with grouped query support
- **Frontend**: New structured TabsContent for layout_variants in `FAQPage.jsx`
- **Frontend**: Expandable cards per model size with variant grid
- **Frontend**: Dialog for adding/editing layout variants with all fields
- **PDF**: Updated image sizes per user specification:
  - Model variants: 110×80
  - Plus categories: 70×55
  - Options catalog: 65×50

### Jan 28, 2025 - Hidden Options Filtering & Model Capacity Field (COMPLETED)
- **NEW**: Hidden options (based on incompatibility rules) are now excluded from order summary and PDF
- **Feature**: `isOptionVisible` helper function checks `incompatibleModels` and `incompatibleWithOptions` rules
- **Feature**: `calculateOptionsTotal` now filters hidden options from price calculation
- **Feature**: `getSelectedOptions` excludes hidden options from PDF generation
- **Feature**: `SelectedOptionsList` hides incompatible options in order summary
- **NEW**: Added `capacity` field to SaunaModel for number of people (e.g., "4-6")
- **Feature**: Capacity displayed in model cards as "👥 X osób" when set
- **Feature**: Capacity editable in admin panel (AddModelDialog, EditModelDialog)
- **Feature**: Capacity included in PDF as "Orientacyjna liczba osób: X" (Polish)
- **NEW**: Added configurable `maxManagerDiscount` setting in admin panel
- **Feature**: Admin can set maximum discount % for managers (non-admin users)
- **Feature**: Default value is 10%, can be changed in Ceny > Sauny admin page
- **Feature**: Discount limit applied in calculator UI and validation
- **NEW**: Added bulk price change functionality in admin panel
- **Feature**: Separate % inputs for models and options prices
- **Feature**: Applies to basePrice, foundationPrice (models) and option/variant prices
- **Feature**: Supports both positive (increase) and negative (decrease) percentages
- **Backend**: Updated `SaunaModel`, `SaunaPDFRequest`, `SaunaPriceData` in `sauna.py`
- **Backend**: PDF generation includes capacity in WYMIARY POMIESZCZEŃ section
- **Frontend**: Updated `SaunaCalculator.jsx`, `useSaunaCalculator.js`, `SaunaPricingPage.jsx`
- **Admin UI**: Updated `ModelDialog.jsx` with capacity field, added maxManagerDiscount in pricing page
- **Tested**: All code correctly implemented (iteration 30, curl PDF test, UI screenshots)

### Jan 28, 2025 - Hot Tub Calculator & Pricing Improvements (COMPLETED)
- **FIX**: Model cards in calculator now show correct number of heater variants (based on availableHeaterTypes)
- **Feature**: Added material tags (Fiberglass/Akryl) to model cards in calculator
- **Feature**: Added heater type tag when model has only one type (Zintegr./Zewn.)
- **NEW**: Added "Calculate Price" button in option edit dialog
- **Feature**: Shows current EUR exchange rate in the pricing section
- **Feature**: Button applies formula: purchasePriceEur × eurRate × (1 + markup%) = retail price
- **Frontend**: Updated `CalculatorPage.jsx` with model card tags
- **Frontend**: Updated `balia-pricing/OptionEditDialog.jsx` with price calculation button
- **Frontend**: Updated `BaliaPricingPage.jsx` to pass eurRate to dialog
- **Frontend**: Updated `balia-pricing/ModelEditDialog.jsx` with price calculation for heater variants
- **Feature**: Each heater variant (integrated/external) has its own Apply button for price calculation

### Jan 29, 2025 - Sauna Model Variants (Sub-models) + Conditional Category Visibility + PDF Page 2 (COMPLETED)
- **NEW**: Added model variants for saunas (like heater variants in hot tubs)
- **Feature**: Each model can have multiple variants with different prices, images, and descriptions
- **Feature**: Variant selector displayed as large cards after model selection
- **Feature**: Price taken from selected variant instead of base model price
- **NEW**: Conditional category visibility based on selected model variant
- **Feature**: Categories can be configured to show only for specific variants (e.g., "Plus" only)
- **Feature**: Admin UI for setting `visibleForModelVariants` in category edit dialog
- **NEW**: PDF Page 2 with variants and options catalog (ENHANCED)
- **Feature**: "Możliwe warianty wykonania w wybranym rozmiarze" - comparison table and variant cards with prices
- **Feature**: Plus-only categories section (if applicable) - options WITHOUT prices
- **Feature**: "Opcje, które można dodać do sauny" - all available options WITHOUT prices grouped by category
- **Feature**: Adaptive layout - 2/3/4 columns based on number of options (no empty spaces)
- **NEW**: `showInPdf` field for options - control which options appear in PDF catalog
- **Feature**: Checkbox "Показывать в PDF (каталог опций)" in option edit dialog
- **NEW**: PDF Page 2 settings in admin panel
- **Feature**: Enable/disable entire page 2
- **Feature**: Custom titles for variants and options sections (Polish text)
- **Feature**: Toggle visibility of: variants, comparison table, Plus-categories, all options catalog
- **Backend**: Added `SaunaModelVariant` class and `variants` field to `SaunaModel`
- **Backend**: Added `showInPdf` field to `SaunaOption` model (default: true)
- **Backend**: Added PDF Page 2 settings to `SaunaPriceData` and `SaunaPDFRequest`
- **Backend**: Page 2 generation with adaptive columns and NO PRICES for options
- **Frontend**: Added `ModelVariantsEditor` component in `ModelDialog.jsx` for admin UI
- **Frontend**: Added `ModelVariantSelector` component in `SaunaCalculator.jsx`
- **Frontend**: Updated `useSaunaCalculator.js` with PDF data collection (filters by showInPdf)
- **Frontend**: Added PDF Page 2 settings UI in `SaunaPricingPage.jsx`
- **Frontend**: Added `showInPdf` checkbox in `OptionDialog.jsx`
- **Tested**: PDF generation verified with 3 pages (iteration 31, curl tests)
- **Feature**: Categories can be configured to show only for specific variants (e.g., "Plus" only)
- **Feature**: Admin UI for setting `visibleForModelVariants` in category edit dialog
- **NEW**: PDF Page 2 with variants and options catalog
- **Feature**: "Możliwe warianty wykonania w wybranym rozmiarze" - comparison table and variant cards
- **Feature**: Plus-only categories section (if applicable)
- **Feature**: "Opcje, które można dodać do sauny" - all available options with images grouped by category
- **Backend**: Added `SaunaModelVariant` class and `variants` field to `SaunaModel`
- **Backend**: Added `selectedModelVariant` to `SaunaOrder` and `SaunaPDFRequest`
- **Backend**: Added `visibleForModelVariants` field to `SaunaCategory` model
- **Backend**: Added Page 2 generation in `generate_sauna_pdf` with variants, comparison table, and options
- **Backend**: Added `modelVariants`, `variantComparisonRows`, `plusOnlyCategories`, `allAvailableOptions` to `SaunaPDFRequest`
- **Frontend**: Added `ModelVariantsEditor` component in `ModelDialog.jsx` for admin UI
- **Frontend**: Added `ModelVariantSelector` component in `SaunaCalculator.jsx`
- **Frontend**: Updated `useSaunaCalculator.js` with PDF data collection for Page 2
- **Frontend**: Added category filtering by `visibleForModelVariants` in `SaunaCalculator.jsx`
- **Admin UI**: Added "Видимость для вариантов модели" input in `CategoriesTab.jsx`
- **Tested**: All features working (iteration 31, PDF generation test)

### Jan 24, 2025 - Room Sizes for Sauna Models (COMPLETED)
- **NEW**: Added room size fields to sauna models: `relaxRoomSize`, `steamRoomSize`
- **Feature**: Alternative sizes for terrace option: `relaxRoomSizeWithTerrace`, `steamRoomSizeWithTerrace`
- **Feature**: Room sizes displayed in model cards in calculator
- **Feature**: Room sizes included in PDF with Polish labels (Przebieralnia, Łaźnia)
- **Tested**: All features working correctly

### Jan 24, 2025 - Sauna Option Variants System (COMPLETED)
- **NEW**: Implemented variant system for sauna options - mutually exclusive choices within an option
- **Feature**: Variants replace base option price (not add to it)
- **Feature**: Variant images are used in PDF generation (replaces parent option image)
- **Feature**: "Dodaj belki" option now uses `foundationPrice` from selected model (dynamic price)
- **Example**: "Ławki 2-poziomowe" option now has variants: "Bez zabudowy" (480 PLN) vs "Z zabudową" (1480 PLN)
- **Backend**: Added `OptionVariant` model in `sauna.py`, kept `SubOption` as alias for backward compatibility
- **Frontend**: Variants display as radio buttons under selected option in `SaunaCalculator.jsx`
- **Admin UI**: Updated `OptionDialog.jsx` with "🔄 Варианты исполнения" section
- **Calculator Logic**: `useSaunaCalculator.js` updated with `handleVariantChange` and `variantSelections` state
- **Tested**: All backend and frontend tests passed (iterations 26, 27)

### Jan 23, 2025 - P0 Blocker Fixed: PDF Generation & Upload to amoCRM from Widget
- **FIXED**: When gifts/discounts are edited via amoCRM widget, a new PDF is now automatically generated and uploaded to the amoCRM lead
- **NEW**: Added `generate_and_upload_pdf_to_amocrm()` function in `widget.py`
- **NEW**: Added `build_pdf_request_from_order()` helper function to construct PDFRequest from order data
- **NEW**: Added `currencySymbol` field to `PDFRequest` model for proper currency display
- **ENHANCED**: Save gifts endpoint now includes PDF upload status in response
- **ENHANCED**: amoCRM note now includes info about PDF update when successful
- **Note**: PDF upload requires amoCRM credentials (domain + token) to be configured in integration settings

### Jan 22, 2025 - P0 Blocker Fixed: amoCRM Widget Edit Order Flow
- **FIXED**: Order editing from amoCRM widget now preserves `amocrm_id` connection
- **FIXED**: Frontend now uses correct `/api/orders` endpoint (was `/api/balia/orders`)
- **FIXED**: `amocrmData` is restored from `editingOrder` in both CalculatorPage.jsx and useSaunaCalculator.js
- **NEW**: Widget now displays change history section (last 5 changes)
- **NEW**: Added `amocrm_name` field to Order model
- **Tested**: All 13 test cases passed for edit flow

### Jan 22, 2025 - Manager Orders Isolation & amoCRM Notifications
- **NEW**: Managers now see only their own orders (filtered by `createdBy`)
- **NEW**: Admins continue to see all orders
- **NEW**: Applies to both Balia (`/api/orders`) and Sauna (`/api/sauna/orders`) endpoints
- **NEW**: amoCRM note sent automatically when order is edited with changes
- **Note**: Note format: "✏️ Заказ изменён пользователем {user}\n\nИзменённые поля: {fields}"
- **Tested**: All 14 test cases passed for filtering and note sending

### Jan 21, 2025 - Content Library Enhancements
- **Fixed**: Public content page now uses absolute URLs for videos/images - videos should now play correctly
- **Fixed**: Added improved headers for PDF files in training module (Cache-Control, X-Frame-Options)
- **Fixed**: Streaming for large files (>1MB) in both training and content modules
- **Fixed**: Upload button now works correctly for individual folders (unique ID per folder)
- **NEW**: Hierarchical folders (subfolders) support in Content Library
- **NEW**: Tree view on public content page with expand/collapse functionality
- **Tested**: GridFS file storage working correctly for training and content files

## Core Features Implemented

### 1. Calculator Modules
- **Balia (Hot Tub)**: Configuration and pricing calculator
- **Sauna**: Configuration and pricing calculator
- PDF generation for orders

### 2. Logistics & Delivery
- Route planning with map integration
- Driver panel for delivery management
- Warehouse panel for order preparation

### 3. Training Module (NEW - Jan 2025)
- Course management (admin)
- Video lessons with Synthesia embeds
- GIF thumbnails support
- Multiple-choice quizzes with passing scores
- Employee progress tracking
- Statistics dashboard

### 4. amoCRM Widget (Enhanced - Jan 2025)
- Enlarged design with more order details
- Debt calculation display
- Allegro order labels
- amoCRM tags display
- "Edit" button for order modification

### 5. Backup System (Fixed - Jan 2025)
- Manual and automatic backups unified
- Optimized backup size (~22MB)
- Excluded logs collection

### 6. Admin Panel
- User management
- Pricing configuration
- Order statistics
- FAQ management
- PDF template editor

## Technical Architecture

```
/app
├── backend (FastAPI)
│   ├── routes/
│   │   ├── amocrm.py        # CRM integration
│   │   ├── backup.py        # Backup system
│   │   ├── balia.py         # Balia orders
│   │   ├── sauna.py         # Sauna orders & PDF (main)
│   │   ├── sauna_crud.py    # Sauna CRUD (modular) - NEW
│   │   ├── sauna_orders.py  # Sauna orders (modular) - NEW
│   │   ├── sauna_wizard.py  # Wizard API (modular) - NEW
│   │   ├── training.py      # Training module API
│   │   └── widget.py        # amoCRM widget
│   ├── services/
│   │   ├── pdf_helpers.py   # PDF utilities - NEW
│   │   └── pdf_sections.py  # PDF section builders - NEW
│   └── server.py
└── frontend (React)
    └── src/
        ├── components/
        │   ├── sauna/
        │   │   ├── useSaunaCalculator.js  # Main hook
        │   │   ├── useLayoutCatalog.js    # Layout catalog - NEW
        │   │   ├── usePriceCalculation.js # Price logic - NEW
        │   │   └── useOptionVisibility.js # Visibility rules - NEW
        │   ├── LandingPage.jsx
        │   ├── TrainingPage.jsx
        │   └── ...
        └── context/
            └── AuthContext.jsx
```

## Key API Endpoints
- `POST /api/auth/login` - Authentication
- `POST /api/backup/auto` - Automatic backup
- `GET /api/widget/embed/{theme}/{lead_id}` - amoCRM widget
- `POST /api/widget/save-gifts/{lead_id}` - Save gifts/discounts and regenerate PDF (NEW)
- `POST /api/training/courses` - Create course
- `POST /api/training/progress/{user_id}/{course_id}/lessons/{lesson_id}/complete` - Track progress

## Database Collections
- `users`, `sauna_orders`, `orders` (balia), `greenhouse_orders`
- `training_courses`, `training_lessons`, `training_progress`
- `backups`, `logs`

## User Roles
- `admin` - Full access
- `employee` - Calculator + Training access
- `driver` - Driver panel only
- `warehouse` - Warehouse panel only
- `observer` - View only

## 3rd Party Integrations
- **amoCRM/Kommo**: CRM integration with tags
- **Synthesia.io**: Training video embeds
- **Google Maps**: Route planning
- **Telegram**: Backup notifications

---

## Changelog

### January 19, 2025
- **ADDED**: Manual refresh from amoCRM feature:
  - Backend endpoint `POST /api/integrations/amocrm/refresh_lead/{section}/{amocrm_id}` - refresh single order
  - Backend endpoint `POST /api/integrations/amocrm/refresh_all/{section}` - refresh all orders
  - "Обновить" button in order card amoCRM block - updates single order
  - Global "Обновить" button in header - updates all orders from amoCRM
  - Shows "Обновлено из amoCRM: [date]" when order was last synced

### January 18, 2025
- **FIXED**: Training module visibility for `employee` role on landing page
- **ADDED**: Training card moved to first row on landing page
- **ADDED**: FAQ tab in Training module with categories (Products, Calculator, amoCRM, Objections)
- **ADDED**: Client Objections system:
  - Managers submit objections with question, context, category
  - Admins answer with response + handling script
  - Answered objections appear in FAQ automatically
  - API: `/api/training/objections`

### January 2025 (Previous Sessions)
- Implemented complete Training Module
- Enhanced amoCRM widget
- Fixed backup system
- Added PDF generation with `pdfGenerated` flag

---

## Backlog

### P1 (High Priority)
- [x] ~~Manual refresh from amoCRM~~ (DONE - Jan 19, 2025)
- [x] ~~Sauna option variants system~~ (DONE - Jan 24, 2025)
- [x] ~~Room sizes for sauna models~~ (DONE - Jan 24, 2025)
- [x] ~~Hidden options filtering from summary/PDF~~ (DONE - Jan 28, 2025)
- [x] ~~Model capacity field~~ (DONE - Jan 28, 2025)
- [ ] Verify automatic backup schedule works correctly

### P2 (Medium Priority)
- [ ] UI for backup import/restore
- [ ] Refactor shared components (CalculatorPage, LogisticsPage, SaunaCalculator)
- [ ] Replace deprecated Google Maps Autocomplete
- [ ] Widget height issue (limited by amoCRM iframe constraints)

### P3 (Low Priority)
- [ ] Sauna Lead Statistics feature
- [ ] Fix unstable login sessions
- [ ] Category hint editing dialog fix in sauna pricing admin
- [ ] Sauna hints not saving on user's hosting

---

## Test Credentials
- Admin: `testuser` / `test123`
- Employee: `sauna_employee` / `test123`
