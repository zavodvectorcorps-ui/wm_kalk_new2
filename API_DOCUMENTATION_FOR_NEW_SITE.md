# API Документация для интеграции калькулятора саун

## Базовый URL
```
Production: https://wm-kalkulator.pl
Preview: https://sauna-sales.preview.emergentagent.com
```

## Эндпоинты

### 1. Получить все данные калькулятора
```
GET /api/sauna/prices
```

**Ответ содержит:**
- `models` - список моделей саун с ценами и изображениями
- `categories` - категории опций с вложенными опциями
- `maxManagerDiscount` - максимальная скидка

**Пример запроса:**
```javascript
const response = await fetch('https://wm-kalkulator.pl/api/sauna/prices');
const data = await response.json();
```

---

### 2. Структура данных

#### Модель сауны (Model)
```json
{
  "id": "sauna_kwadro_beczka_235x200_cm",
  "name": "Sauna Kwadro-Beczka 235x200 cm",
  "basePrice": 14200,
  "foundationPrice": 150,
  "discount": 10,
  "imageUrl": "/api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg",
  "capacity": "4",
  "relaxRoomSize": "От 300см",
  "steamRoomSize": "185",
  "layoutSize": "2m",
  "active": true,
  "sortOrder": 1,
  "variants": [
    {
      "id": "variant_123",
      "namePl": "вариант 1 стандарт",
      "price": 0,
      "imageUrl": "",
      "hint": "",
      "capacity": "",
      "terraceSize": "",
      "relaxRoomSize": "",
      "steamRoomSize": ""
    }
  ],
  "galleryImages": [
    "https://wm-kalkulator.pl/api/uploads/xxx.jpg",
    "https://wm-kalkulator.pl/api/uploads/yyy.jpg"
  ],
  "hint": "Описание модели",
  "hintImageUrl": "/api/uploads/hint_image.jpg",
  "hintVideoUrl": "https://youtube.com/..."
}
```

#### Категория опций (Category)
```json
{
  "id": "lawki",
  "name": "Ławki",
  "nameRu": "Лавки",
  "namePl": "Ławki",
  "sortOrder": 1,
  "hint": "Подсказка для категории",
  "hintImageUrl": "/api/uploads/hint.jpg",
  "visibleForModelVariants": [],
  "options": [...]
}
```

#### Опция (Option)
```json
{
  "id": "lawki_standard_1",
  "name": "Standart (1 poziom)",
  "price": 0,
  "inputType": "radio",
  "imageUrl": "https://i.imgur.com/ff4dvj5.jpeg",
  "hasQuantity": false,
  "isDefaultSelected": false,
  "hint": "Описание опции",
  "showInPdf": true,
  "variants": [],
  "incompatibleModels": [],
  "incompatibleWithOptions": {}
}
```

---

### 3. Работа с изображениями

**Типы URL изображений:**

1. **Относительные URL** (хранятся в MongoDB):
   ```
   /api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg
   ```
   Полный URL: `https://wm-kalkulator.pl/api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg`

2. **Внешние URL** (imgur, cloudinary):
   ```
   https://i.imgur.com/ff4dvj5.jpeg
   https://res.cloudinary.com/xxx/image/upload/v1234/image.jpg
   ```

**Функция для получения полного URL:**
```javascript
const BASE_URL = 'https://wm-kalkulator.pl';

function getFullImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${BASE_URL}${imageUrl}`;
}
```

---

### 4. Генерация PDF
```
POST /api/sauna/generate-pdf
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "modelName": "Sauna Kwadro-Beczka 235x200 cm",
  "modelPrice": 14200,
  "modelDiscount": 10,
  "modelDiscountAmount": 1420,
  "modelImageUrl": "/api/uploads/xxx.jpg",
  "selectedOptions": [
    {
      "categoryName": "Ławki",
      "optionName": "Standart (1 poziom)",
      "price": 0,
      "quantity": 1,
      "imageUrl": "..."
    }
  ],
  "optionsTotal": 5000,
  "totalPrice": 17780,
  "customerName": "Jan Kowalski",
  "customerPhone": "+48123456789",
  "customerEmail": "jan@example.com",
  "deliveryAddress": "Warszawa, ul. Przykładowa 1"
}
```

**Ответ:** PDF файл (application/pdf)

---

### 5. Пример упрощённого калькулятора (React)

```jsx
import React, { useState, useEffect } from 'react';

const API_URL = 'https://wm-kalkulator.pl';

function SimpleSaunaCalculator() {
  const [data, setData] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});

  useEffect(() => {
    fetch(`${API_URL}/api/sauna/prices`)
      .then(res => res.json())
      .then(setData);
  }, []);

  const getImageUrl = (url) => {
    if (!url) return '/placeholder.jpg';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
  };

  const calculateTotal = () => {
    if (!selectedModel) return 0;
    let total = selectedModel.basePrice;
    
    // Add options prices
    Object.values(selectedOptions).forEach(opt => {
      if (opt?.price) total += opt.price;
    });
    
    // Apply discount
    if (selectedModel.discount) {
      total = total * (1 - selectedModel.discount / 100);
    }
    
    return Math.round(total);
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h1>Kalkulator Saun</h1>
      
      {/* Models */}
      <div className="models-grid">
        {data.models.filter(m => m.active).map(model => (
          <div 
            key={model.id}
            className={`model-card ${selectedModel?.id === model.id ? 'selected' : ''}`}
            onClick={() => setSelectedModel(model)}
          >
            <img src={getImageUrl(model.imageUrl)} alt={model.name} />
            <h3>{model.name}</h3>
            <p>{model.basePrice} PLN</p>
            {model.capacity && <span>👥 {model.capacity} osób</span>}
          </div>
        ))}
      </div>

      {/* Options */}
      {selectedModel && data.categories.map(category => (
        <div key={category.id} className="category">
          <h3>{category.namePl || category.name}</h3>
          <div className="options-grid">
            {category.options.map(option => (
              <div 
                key={option.id}
                className={`option-card ${selectedOptions[category.id]?.id === option.id ? 'selected' : ''}`}
                onClick={() => setSelectedOptions({
                  ...selectedOptions,
                  [category.id]: option
                })}
              >
                {option.imageUrl && (
                  <img src={getImageUrl(option.imageUrl)} alt={option.name} />
                )}
                <span>{option.name}</span>
                <span>{option.price > 0 ? `+${option.price} PLN` : 'w zestawie'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Total */}
      <div className="total">
        <h2>Razem: {calculateTotal()} PLN</h2>
      </div>
    </div>
  );
}

export default SimpleSaunaCalculator;
```

---

### 6. CORS

API поддерживает CORS для всех доменов (`*`), поэтому вызовы с любого сайта будут работать.

---

### 7. Контакты

При возникновении вопросов по API обращайтесь к администратору wm-kalkulator.pl
