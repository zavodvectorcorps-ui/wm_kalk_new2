# 🛁 API Документация для интеграции калькулятора купелей (Balia)

## Базовый URL
```
Production: https://wm-kalkulator.pl
```

---

## 📡 Эндпоинты

### 1. Получить все данные калькулятора (прайс)
```
GET /api/prices
```

**Пример запроса:**
```javascript
const API_URL = 'https://wm-kalkulator.pl';
const response = await fetch(`${API_URL}/api/prices`);
const data = await response.json();
```

### 2. Публичный прайс (без авторизации)
```
GET /api/public/prices
```

### 3. Генерация PDF предложения
```
POST /api/generate-pdf
Content-Type: application/json
```

### 4. Экспорт прайса
```
GET /api/prices/export
```

---

## 📦 Структура ответа `/api/prices`

```json
{
  "models": [...],              // Модели купелей
  "categories": [...],          // Категории опций
  "deliveryPricePerKm": 5,      // Цена доставки за км
  "freeDeliveryRadius": 50,     // Бесплатная доставка в радиусе (км)
  "installationPrice": 500,     // Цена установки
  "currency": "PLN"
}
```

---

## 🏗️ Модель купели (Model)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор |
| `name` | string | Название (внутреннее) |
| `nameRu` | string | Название на русском |
| `namePl` | string | Название на польском |
| `price` | number | Базовая цена в PLN |
| `image` | string | URL главного изображения |
| `active` | boolean | Активна ли модель |
| `sortOrder` | number | Порядок сортировки |

### Характеристики модели:
| Поле | Тип | Описание |
|------|-----|----------|
| `dimensions` | string | Размеры (напр. "180x100 см") |
| `capacity` | string | Вместимость (напр. "4-6 человек") |
| `innerDimensions` | string | Внутренние размеры |
| `outerDimensions` | string | Внешние размеры |
| `depth` | string | Глубина |
| `weight` | string | Вес |
| `waterVolume` | string | Объём воды |

### Подсказки и описания:
| Поле | Тип | Описание |
|------|-----|----------|
| `hint` | string | Текстовое описание/подсказка (RU) |
| `hintPl` | string | Описание на польском |
| `hintImageUrl` | string | URL изображения для подсказки |
| `hintVideoUrl` | string | URL видео (YouTube) |

### Пример модели:
```json
{
  "id": "balia-180",
  "name": "Balia 180",
  "nameRu": "Купель 180",
  "namePl": "Balia 180",
  "price": 12500,
  "image": "https://res.cloudinary.com/xxx/image/upload/v123/balia-180.jpg",
  "dimensions": "180x100 см",
  "capacity": "4-6 человек",
  "innerDimensions": "160x80 см",
  "depth": "100 см",
  "waterVolume": "1000 л",
  "hint": "Идеальный размер для семьи",
  "hintPl": "Idealny rozmiar dla rodziny",
  "active": true,
  "sortOrder": 1
}
```

---

## 📂 Категория опций (Category)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный ID категории |
| `name` | string | Название (внутреннее) |
| `nameRu` | string | Название на русском |
| `namePl` | string | Название на польском |
| `hint` | string | Описание категории (RU) |
| `hintPl` | string | Описание на польском |
| `hintImageUrl` | string | URL изображения |
| `hintVideoUrl` | string | URL видео |
| `inputType` | string | Тип выбора: "single", "multiple", "checkbox" |
| `required` | boolean | Обязательна ли категория |
| `sortOrder` | number | Порядок сортировки |
| `options` | array | Массив опций |

### Типы категорий:
- **single** — выбор одной опции (radio)
- **multiple** — множественный выбор (checkbox)
- **checkbox** — да/нет (single checkbox)

### Пример категории:
```json
{
  "id": "wood_type",
  "name": "Wood Type",
  "nameRu": "Тип дерева",
  "namePl": "Rodzaj drewna",
  "hint": "Выберите тип древесины для купели",
  "hintPl": "Wybierz rodzaj drewna do balii",
  "inputType": "single",
  "required": true,
  "sortOrder": 1,
  "options": [...]
}
```

---

## ⚙️ Опция (Option)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный ID опции |
| `name` | string | Название (внутреннее) |
| `nameRu` | string | Название на русском |
| `namePl` | string | Название на польском |
| `price` | number | Цена опции (+/- к базовой) |
| `image` | string | URL изображения опции |
| `imageUrl` | string | Альтернативное поле для URL изображения |
| `hint` | string | Описание опции (RU) |
| `hintPl` | string | Описание на польском |
| `hintImageUrl` | string | URL изображения подсказки |
| `hintVideoUrl` | string | URL видео |
| `active` | boolean | Активна ли опция |
| `sortOrder` | number | Порядок сортировки |
| `isDefault` | boolean | Выбрана по умолчанию |

### Пример опции:
```json
{
  "id": "oak",
  "name": "Oak",
  "nameRu": "Дуб",
  "namePl": "Dąb",
  "price": 2500,
  "image": "https://res.cloudinary.com/xxx/image/upload/oak.jpg",
  "hint": "Прочная и долговечная древесина",
  "hintPl": "Trwałe i wytrzymałe drewno",
  "active": true,
  "sortOrder": 1,
  "isDefault": false
}
```

---

## 📄 Генерация PDF

### Запрос:
```
POST /api/generate-pdf
Content-Type: application/json
```

### Тело запроса:
```json
{
  "model": {
    "id": "balia-180",
    "name": "Balia 180",
    "namePl": "Balia 180",
    "price": 12500,
    "image": "https://..."
  },
  "selectedOptions": [
    {
      "categoryId": "wood_type",
      "categoryName": "Rodzaj drewna",
      "optionId": "oak",
      "optionName": "Dąb",
      "price": 2500,
      "imageUrl": "https://..."
    },
    {
      "categoryId": "heater",
      "categoryName": "Piec",
      "optionId": "external_heater",
      "optionName": "Piec zewnętrzny",
      "price": 3500
    }
  ],
  "clientInfo": {
    "name": "Jan Kowalski",
    "phone": "+48 123 456 789",
    "email": "jan@example.com",
    "address": "ul. Przykładowa 1, Warszawa"
  },
  "totalPrice": 18500,
  "discount": 0,
  "discountedPrice": 18500,
  "language": "pl",
  "notes": "Dodatkowe uwagi"
}
```

### Ответ:
PDF файл (binary, application/pdf)

---

## 💻 Пример React компонента

```jsx
import React, { useState, useEffect } from 'react';

const API_URL = 'https://wm-kalkulator.pl/api';

function BaliaCalculator() {
  const [prices, setPrices] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загрузка прайса при монтировании
  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/prices`);
      if (!response.ok) throw new Error('Failed to fetch prices');
      const data = await response.json();
      setPrices(data);
      
      // Установить первую модель по умолчанию
      if (data.models?.length > 0) {
        const activeModels = data.models.filter(m => m.active !== false);
        if (activeModels.length > 0) {
          setSelectedModel(activeModels[0]);
        }
      }
      
      // Установить опции по умолчанию
      const defaults = {};
      data.categories?.forEach(cat => {
        const defaultOption = cat.options?.find(o => o.isDefault);
        if (defaultOption) {
          defaults[cat.id] = defaultOption;
        }
      });
      setSelectedOptions(defaults);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Расчёт итоговой цены
  const calculateTotal = () => {
    if (!selectedModel) return 0;
    
    let total = selectedModel.price || 0;
    
    Object.values(selectedOptions).forEach(option => {
      if (option?.price) {
        total += Number(option.price);
      }
    });
    
    return total;
  };

  // Выбор опции
  const handleOptionSelect = (categoryId, option) => {
    setSelectedOptions(prev => ({
      ...prev,
      [categoryId]: option
    }));
  };

  // Генерация PDF
  const generatePDF = async (clientInfo) => {
    try {
      const requestBody = {
        model: selectedModel,
        selectedOptions: Object.entries(selectedOptions).map(([catId, opt]) => {
          const category = prices.categories.find(c => c.id === catId);
          return {
            categoryId: catId,
            categoryName: category?.namePl || category?.name,
            optionId: opt.id,
            optionName: opt.namePl || opt.name,
            price: opt.price,
            imageUrl: opt.image || opt.imageUrl
          };
        }),
        clientInfo,
        totalPrice: calculateTotal(),
        language: 'pl'
      };
      
      const response = await fetch(`${API_URL}/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oferta-balia-${selectedModel?.namePl || 'offer'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Nie udało się wygenerować PDF');
    }
  };

  if (loading) return <div className="loading">Ładowanie...</div>;
  if (error) return <div className="error">Błąd: {error}</div>;
  if (!prices) return <div className="error">Brak danych</div>;

  const activeModels = prices.models?.filter(m => m.active !== false) || [];
  const activeCategories = prices.categories?.filter(c => c.active !== false) || [];

  return (
    <div className="balia-calculator">
      {/* Выбор модели */}
      <section className="models-section">
        <h2>Wybierz model</h2>
        <div className="models-grid">
          {activeModels.map(model => (
            <div 
              key={model.id}
              className={`model-card ${selectedModel?.id === model.id ? 'selected' : ''}`}
              onClick={() => setSelectedModel(model)}
            >
              {model.image && (
                <img src={model.image} alt={model.namePl || model.name} />
              )}
              <h3>{model.namePl || model.nameRu || model.name}</h3>
              {model.dimensions && <p className="dimensions">{model.dimensions}</p>}
              {model.capacity && <p className="capacity">{model.capacity}</p>}
              <p className="price">{model.price?.toLocaleString()} PLN</p>
              {model.hintPl && <p className="hint">{model.hintPl}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Категории опций */}
      {activeCategories.map(category => {
        const activeOptions = category.options?.filter(o => o.active !== false) || [];
        if (activeOptions.length === 0) return null;
        
        return (
          <section key={category.id} className="category-section">
            <h2>{category.namePl || category.nameRu || category.name}</h2>
            {category.hintPl && <p className="category-hint">{category.hintPl}</p>}
            
            <div className="options-grid">
              {activeOptions.map(option => (
                <div
                  key={option.id}
                  className={`option-card ${selectedOptions[category.id]?.id === option.id ? 'selected' : ''}`}
                  onClick={() => handleOptionSelect(category.id, option)}
                >
                  {(option.image || option.imageUrl) && (
                    <img 
                      src={option.image || option.imageUrl} 
                      alt={option.namePl || option.name} 
                    />
                  )}
                  <h4>{option.namePl || option.nameRu || option.name}</h4>
                  <p className="option-price">
                    {option.price > 0 ? '+' : ''}{option.price?.toLocaleString()} PLN
                  </p>
                  {option.hintPl && <p className="option-hint">{option.hintPl}</p>}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Итого */}
      <section className="total-section">
        <div className="total-price">
          <span>Razem:</span>
          <strong>{calculateTotal().toLocaleString()} PLN</strong>
        </div>
        
        <button 
          className="pdf-button"
          onClick={() => generatePDF({ name: 'Klient' })}
        >
          Pobierz ofertę PDF
        </button>
      </section>
    </div>
  );
}

export default BaliaCalculator;
```

---

## 🎨 Пример CSS стилей

```css
.balia-calculator {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.models-grid, .options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.model-card, .option-card {
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.model-card:hover, .option-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.model-card.selected, .option-card.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.model-card img, .option-card img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 10px;
}

.model-card h3, .option-card h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
}

.price, .option-price {
  font-weight: 600;
  color: #3b82f6;
  font-size: 1.1em;
}

.hint, .option-hint, .category-hint {
  color: #6b7280;
  font-size: 0.9em;
  margin-top: 8px;
}

.total-section {
  margin-top: 40px;
  padding: 30px;
  background: #f8fafc;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-price {
  font-size: 1.5em;
}

.total-price strong {
  color: #3b82f6;
  margin-left: 10px;
}

.pdf-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 8px;
  font-size: 1.1em;
  cursor: pointer;
  transition: background 0.2s;
}

.pdf-button:hover {
  background: #2563eb;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  font-size: 1.2em;
}

.error {
  color: #ef4444;
}
```

---

## 🔧 CORS и кэширование

- **CORS**: Разрешены все домены (`Access-Control-Allow-Origin: *`)
- **Кэширование**: Прайс кэшируется на 5 минут (`Cache-Control: public, max-age=300`)
- **Изображения**: Хранятся в Cloudinary, автоматически оптимизированы

---

## 📞 Поддержка

При возникновении вопросов по интеграции обращайтесь к разработчику.
