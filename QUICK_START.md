# 🚀 Быстрый старт - Шпаргалка

## 📍 Основные URL

- **Веб-приложение**: http://localhost:3000
- **Backend API**: http://localhost:8001/api
- **API документация**: http://localhost:8001/docs (автоматическая от FastAPI)

---

## 💰 Управление ценами

### 🔐 Вход (требуется пароль)
**Пароль администратора: `159357`**

### Через веб-интерфейс (проще всего):
1. Откройте http://localhost:3000
2. Нажмите **"💲 Цены"** в верхней панели
3. **Введите пароль**: `159357` и нажмите "Войти"
4. Измените нужные цены
5. Нажмите **"Обновить цены"** внизу страницы
6. Для выхода нажмите кнопку LogOut рядом с бейджем "Админ"

### Через API:
```bash
# Получить текущие цены
curl http://localhost:8001/api/prices | jq

# Обновить цены
curl -X POST http://localhost:8001/api/prices \
  -H "Content-Type: application/json" \
  -d '{"shellModels": {"round200": 1600}, "woodTypes": {}, "shellColors": {}, "lidTypes": {}, "woodColors": {}, "features": {}}'
```

---

## 📦 Работа с заказами

### Создать заказ через интерфейс:
1. Откройте http://localhost:3000
2. Заполните форму клиента
3. Выберите конфигурацию купели
4. Отметьте нужные опции
5. Нажмите **"Сохранить заказ"**

### Посмотреть заказы:
1. Нажмите **"📋 Заказы"** в верхней панели
2. Скачайте PDF (клиентский или технический)

### Через API:
```bash
# Получить все заказы
curl http://localhost:8001/api/orders | jq

# Создать заказ
curl -X POST http://localhost:8001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Тест",
    "phoneNumber": "+48 123",
    "fullAddress": "Адрес",
    "orderDate": "2025-01-15",
    "shellModel": "round200",
    "woodType": "thermo",
    "shellColor": "white",
    "lidType": "glassFiberLid",
    "woodColor": "natural",
    "sandFilter": "none",
    "features": {"jacuzzi": true},
    "notes": "",
    "total": 2600.00
  }'
```

---

## 🗄️ База данных MongoDB

```bash
# Подключиться
mongosh

# Выбрать базу
use hottub_calculator

# Посмотреть цены
db.prices.findOne()

# Посмотреть заказы
db.orders.find().pretty()

# Удалить тестовые заказы
db.orders.deleteMany({ "fullName": /Тест/ })
```

---

## 🔧 Управление сервисами

```bash
# Статус всех сервисов
sudo supervisorctl status

# Перезапуск
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl restart all

# Логи
sudo supervisorctl tail -50 backend stderr
sudo supervisorctl tail -50 frontend stderr
```

---

## 🧪 Быстрый тест

```bash
# 1. Проверить API
curl http://localhost:8001/api/

# 2. Проверить цены
curl http://localhost:8001/api/prices | jq '.shellModels'

# 3. Проверить frontend
curl -I http://localhost:3000

# 4. Создать тестовый заказ
curl -X POST http://localhost:8001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test","phoneNumber":"+48","fullAddress":"Test","orderDate":"2025-01-15","shellModel":"round200","woodType":"spruce","shellColor":"white","lidType":"glassFiberLid","woodColor":"natural","sandFilter":"none","features":{},"notes":"","total":1700}'

# 5. Проверить заказы
curl http://localhost:8001/api/orders | jq
```

---

## 📱 Основные функции приложения

### Калькулятор:
- ✅ 6 моделей купелей
- ✅ 4 типа дерева
- ✅ 15 цветов оболочки
- ✅ 2 типа крышек
- ✅ 10 цветов дерева
- ✅ 18+ дополнительных опций
- ✅ Автоматический расчет стоимости
- ✅ Генерация 2 видов PDF

### Управление:
- ✅ Список всех заказов
- ✅ Редактирование цен
- ✅ Переключение языков (RU/PL)
- ✅ Экспорт в PDF

---

## 🎨 Изменение ассортимента

Если нужно добавить/удалить опции:

1. **Backend** - добавьте в `/app/backend/server.py`:
   - В `default_prices` добавьте новые опции с ценами

2. **Frontend** - обновите компоненты:
   - `/app/frontend/src/components/ConfigurationForm.jsx` - для конфигурации
   - `/app/frontend/src/components/FeaturesForm.jsx` - для опций
   - `/app/frontend/src/components/PricingPage.jsx` - для управления ценами

3. **Переводы** - добавьте в:
   - `/app/frontend/src/i18n/locales/ru.json`
   - `/app/frontend/src/i18n/locales/pl.json`

4. Перезапустите:
```bash
sudo supervisorctl restart all
```

---

## 📞 Полезные команды

```bash
# Очистить все заказы в БД
mongosh hottub_calculator --eval "db.orders.deleteMany({})"

# Сбросить цены к начальным
mongosh hottub_calculator --eval "db.prices.deleteMany({})"
# Затем перезапустить backend - он создаст начальные цены

# Проверить доступность портов
netstat -tulpn | grep -E '3000|8001|27017'

# Посмотреть использование места на диске
df -h

# Backup базы данных
mongodump --db hottub_calculator --out /tmp/backup
```

---

## 📖 Документация

- **Полное руководство**: `/app/HOT_TUB_CALCULATOR_README.md`
- **Руководство по тестированию**: `/app/TESTING_GUIDE.md`
- **Эта шпаргалка**: `/app/QUICK_START.md`

---

**🎉 Готово! Все работает и готово к использованию!**
