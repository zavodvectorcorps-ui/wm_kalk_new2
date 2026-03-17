# 🏠 API Документация для интеграции калькулятора саун

## Базовый URL
```
Production: https://wm-kalkulator.pl
Preview: https://order-tracker-pro-5.preview.emergentagent.com
```

---

## 📡 Эндпоинты

### 1. Получить все данные калькулятора
```
GET /api/sauna/prices
```

**Пример запроса:**
```javascript
const API_URL = 'https://wm-kalkulator.pl';
const response = await fetch(`${API_URL}/api/sauna/prices`);
const data = await response.json();
```

---

## 📦 Структура ответа

```json
{
  "models": [...],              // Модели саун
  "categories": [...],          // Категории опций
  "modelsDisplayType": "grid",  // Тип отображения моделей
  "modelsHint": "...",          // Общая подсказка для моделей
  "modelsHintImageUrl": "...",  // Изображение подсказки
  "modelsHintVideoUrl": "...",  // Видео подсказки
  "maxManagerDiscount": 10,     // Максимальная скидка менеджера (%)
  
  // Настройки PDF страницы 2
  "pdfPage2Enabled": true,
  "pdfPage2VariantsTitle": "...",
  "pdfPage2OptionsTitle": "...",
  "pdfPage2ShowVariants": true,
  "pdfPage2ShowComparisonTable": true,
  "pdfPage2ShowPlusCategories": true,
  "pdfPage2ShowAllOptions": true,
  "variantComparisonRows": [...],
  "variantComparisonTitle": "..."
}
```

---

## 🏗️ Модель сауны (Model)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор |
| `name` | string | Название модели (на русском) |
| `namePl` | string | Название на польском |
| `basePrice` | number | Базовая цена в PLN |
| `foundationPrice` | number | Цена фундамента/опор в PLN |
| `discount` | number | Скидка в процентах (0-100) |
| `imageUrl` | string | URL главного изображения |
| `galleryImages` | string[] | Массив URL дополнительных фото |
| `active` | boolean | Активна ли модель |
| `sortOrder` | number | Порядок сортировки |

### Характеристики модели:
| Поле | Тип | Описание |
|------|-----|----------|
| `capacity` | string | Вместимость (кол-во человек), напр. "4-6" |
| `layoutSize` | string | Размер планировки: "2m", "2.5m", "3m" и т.д. |
| `relaxRoomSize` | string | Размер комнаты отдыха |
| `steamRoomSize` | string | Размер парной |
| `relaxRoomSizeWithTerrace` | string | Размер комнаты отдыха (с террасой) |
| `steamRoomSizeWithTerrace` | string | Размер парной (с террасой) |

### Подсказки и описания:
| Поле | Тип | Описание |
|------|-----|----------|
| `hint` | string | Текстовое описание/подсказка |
| `hintImageUrl` | string | URL изображения для подсказки |
| `hintVideoUrl` | string | URL видео (YouTube) |

### Варианты модели (variants):
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID варианта |
| `name` | string | Название варианта (RU) |
| `namePl` | string | Название варианта (PL) |
| `price` | number | Доплата за вариант (+/-) |
| `imageUrl` | string | Изображение варианта |
| `hint` | string | Описание варианта |
| `hintPl` | string | Описание на польском |
| `category` | string | Категория варианта |
| `capacity` | string | Вместимость |
| `terraceSize` | string | Размер террасы |
| `relaxRoomSize` | string | Размер комнаты отдыха |
| `steamRoomSize` | string | Размер парной |
| `entranceSide` | string | Сторона входа |

**Пример модели:**
```json
{
  "id": "sauna_kwadro_beczka_235x200_cm",
  "name": "Sauna Kwadro-Beczka 235x200 cm",
  "namePl": "Sauna Kwadro-Beczka 235x200 cm",
  "basePrice": 14200,
  "foundationPrice": 150,
  "discount": 10,
  "imageUrl": "/api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg",
  "galleryImages": [
    "https://wm-kalkulator.pl/api/uploads/b3662826e676449a8d14813b140502a8.jpg",
    "https://wm-kalkulator.pl/api/uploads/97793db966cc494e9257ecc6349ada9f.jpg"
  ],
  "capacity": "4",
  "layoutSize": "2m",
  "relaxRoomSize": "От 300см",
  "steamRoomSize": "185",
  "hint": "Компактная сауна-бочка для небольших участков",
  "hintVideoUrl": "https://youtube.com/watch?v=xxx",
  "active": true,
  "sortOrder": 1,
  "variants": [
    {
      "id": "variant_123",
      "namePl": "Стандарт",
      "price": 0,
      "hint": "Базовая комплектация",
      "relaxRoomSize": "2x2m",
      "steamRoomSize": "2x2m"
    },
    {
      "id": "variant_456",
      "namePl": "С террасой",
      "price": 2000,
      "hint": "Увеличенная терраса",
      "terraceSize": "2x1.5m"
    }
  ]
}
```

---

## 📂 Категория опций (Category)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор |
| `name` | string | Название категории (RU) |
| `namePl` | string | Название на польском |
| `nameRu` | string | Название на русском |
| `inputType` | string | Тип выбора: "radio" (один) / "checkbox" (несколько) |
| `displayType` | string | Тип отображения: "grid" / "list" |
| `sortOrder` | number | Порядок сортировки |
| `hint` | string | Описание категории |
| `hintImageUrl` | string | Изображение для подсказки |
| `hintVideoUrl` | string | Видео для подсказки |
| `visibleForModelVariants` | string[] | Показывать только для определённых вариантов |
| `options` | Option[] | Массив опций в категории |

**Пример категории:**
```json
{
  "id": "lawki",
  "name": "Ławki",
  "nameRu": "Лавки",
  "namePl": "Ławki",
  "inputType": "radio",
  "displayType": "grid",
  "sortOrder": 5,
  "hint": "Выберите тип лавок для вашей сауны",
  "hintImageUrl": "/api/uploads/lawki_hint.jpg",
  "visibleForModelVariants": ["plus", "premium"],
  "options": [...]
}
```

---

## ⚙️ Опция (Option)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный идентификатор |
| `name` | string | Название опции |
| `namePl` | string | Название на польском |
| `nameRu` | string | Название на русском |
| `price` | number | Цена опции в PLN (0 = включено в базу) |
| `inputType` | string | Тип: "radio" / "checkbox" |
| `sortOrder` | number | Порядок сортировки |
| `imageUrl` | string | URL изображения опции |
| `hasQuantity` | boolean | Можно ли выбрать количество |
| `isDefaultSelected` | boolean | Выбрана по умолчанию |

### Описания опции:
| Поле | Тип | Описание |
|------|-----|----------|
| `hint` | string | Текстовое описание опции |
| `hintImageUrl` | string | Изображение для подсказки |
| `hintVideoUrl` | string | Видео для подсказки |

### Характеристики опции:
| Поле | Тип | Описание |
|------|-----|----------|
| `terraceSize` | string | Размер террасы (если применимо) |
| `relaxRoomSize` | string | Влияние на размер комнаты отдыха |
| `steamRoomSize` | string | Влияние на размер парной |
| `entranceSide` | string | Сторона входа |

### Варианты исполнения опции:
| Поле | Тип | Описание |
|------|-----|----------|
| `variants` | Variant[] | Варианты исполнения (напр. "С заbudową" / "Без заbudowy") |

### Совместимость:
| Поле | Тип | Описание |
|------|-----|----------|
| `incompatibleModels` | string[] | Несовместимые модели (ID) |
| `incompatibleWithOptions` | object | Несовместимые опции |
| `compatibleModels` | string[] | Только для этих моделей |
| `compatibleWithOptions` | object | Требует выбора других опций |
| `priceByModel` | object | Разные цены для разных моделей |
| `showInPdfForModels` | string[] | Показывать в PDF только для этих моделей |

### PDF настройки:
| Поле | Тип | Описание |
|------|-----|----------|
| `showInPdf` | boolean | Показывать в каталоге опций PDF |
| `techSpecId` | string | ID в технической спецификации |

**Пример опции:**
```json
{
  "id": "lawki_2_poziomowe",
  "name": "Ławki 2-poziomowe",
  "nameRu": "Лавки 2-уровневые",
  "namePl": "Ławki 2-poziomowe",
  "price": 1200,
  "inputType": "radio",
  "imageUrl": "https://wm-kalkulator.pl/api/uploads/lawki_2.jpg",
  "hasQuantity": false,
  "isDefaultSelected": false,
  "hint": "Двухуровневые лавки из термодревесины",
  "hintImageUrl": "/api/uploads/lawki_hint.jpg",
  "showInPdf": true,
  "variants": [
    {
      "id": "bez_zabudowy",
      "name": "Bez zabudowy",
      "price": 480,
      "imageUrl": "/api/uploads/bez_zabudowy.jpg"
    },
    {
      "id": "z_zabudowa",
      "name": "Z zabudową",
      "price": 1480,
      "imageUrl": "/api/uploads/z_zabudowa.jpg"
    }
  ],
  "incompatibleModels": ["mini_sauna_150"],
  "priceByModel": {
    "sauna_large_300": 1500,
    "sauna_xl_350": 1800
  }
}
```

---

## 🖼️ Работа с изображениями

### Типы URL:

1. **Относительные** (хранятся в MongoDB):
   ```
   /api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg
   ```

2. **Абсолютные** (внешние хостинги):
   ```
   https://i.imgur.com/ff4dvj5.jpeg
   https://res.cloudinary.com/xxx/image/upload/image.jpg
   ```

### Функция для преобразования URL:
```javascript
const API_URL = 'https://wm-kalkulator.pl';

function getFullImageUrl(imageUrl) {
  if (!imageUrl) return null;
  
  // Уже полный URL
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // Относительный URL - добавляем базовый
  return `${API_URL}${imageUrl}`;
}

// Использование:
const fullUrl = getFullImageUrl(model.imageUrl);
// "/api/uploads/xxx.jpg" → "https://wm-kalkulator.pl/api/uploads/xxx.jpg"
```

---

## 📄 Генерация PDF

```
POST /api/sauna/generate-pdf
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "modelId": "sauna_kwadro_beczka_235x200_cm",
  "modelName": "Sauna Kwadro-Beczka 235x200 cm",
  "modelPrice": 14200,
  "modelDiscount": 10,
  "modelDiscountAmount": 1420,
  "modelImageUrl": "/api/uploads/xxx.jpg",
  "selectedModelVariant": {
    "id": "variant_123",
    "name": "Стандарт",
    "price": 0
  },
  "selectedOptions": [
    {
      "categoryId": "lawki",
      "categoryName": "Ławki",
      "optionId": "lawki_2_poziomowe",
      "optionName": "Ławki 2-poziomowe",
      "price": 1200,
      "quantity": 1,
      "imageUrl": "/api/uploads/lawki.jpg",
      "selectedVariant": {
        "id": "z_zabudowa",
        "name": "Z zabudową",
        "price": 1480
      }
    }
  ],
  "optionsTotal": 5000,
  "totalPrice": 17780,
  "customerName": "Jan Kowalski",
  "customerPhone": "+48123456789",
  "customerEmail": "jan@example.com",
  "customerCompany": "Firma ABC",
  "deliveryAddress": "Warszawa, ul. Przykładowa 1",
  "notes": "Доставка в выходные"
}
```

**Ответ:** PDF файл (`Content-Type: application/pdf`)

---

## 💻 Пример React компонента

```jsx
import React, { useState, useEffect } from 'react';

const API_URL = 'https://wm-kalkulator.pl';

function SaunaCalculator() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});

  // Загрузка данных
  useEffect(() => {
    fetch(`${API_URL}/api/sauna/prices`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Ошибка загрузки:', err);
        setLoading(false);
      });
  }, []);

  // Преобразование URL изображений
  const getImageUrl = (url) => {
    if (!url) return '/placeholder.jpg';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
  };

  // Расчёт итоговой цены
  const calculateTotal = () => {
    if (!selectedModel) return 0;
    
    let total = selectedModel.basePrice;
    
    // Добавляем цену варианта модели
    if (selectedVariant?.price) {
      total += selectedVariant.price;
    }
    
    // Добавляем цены опций
    Object.values(selectedOptions).forEach(opt => {
      if (opt?.price) total += opt.price;
      // Если выбран вариант опции
      if (opt?.selectedVariant?.price) {
        total += opt.selectedVariant.price - (opt.price || 0);
      }
    });
    
    // Применяем скидку
    if (selectedModel.discount) {
      total = total * (1 - selectedModel.discount / 100);
    }
    
    return Math.round(total);
  };

  // Выбор модели
  const handleModelSelect = (model) => {
    setSelectedModel(model);
    setSelectedVariant(model.variants?.[0] || null);
    setSelectedOptions({});
  };

  // Выбор опции
  const handleOptionSelect = (categoryId, option) => {
    setSelectedOptions(prev => ({
      ...prev,
      [categoryId]: option
    }));
  };

  if (loading) {
    return <div className="loading">Загрузка калькулятора...</div>;
  }

  if (!data) {
    return <div className="error">Ошибка загрузки данных</div>;
  }

  return (
    <div className="sauna-calculator">
      <h1>Калькулятор саун</h1>
      
      {/* Выбор модели */}
      <section className="models-section">
        <h2>Выберите модель</h2>
        <div className="models-grid">
          {data.models
            .filter(m => m.active)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(model => (
              <div 
                key={model.id}
                className={`model-card ${selectedModel?.id === model.id ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model)}
              >
                <img 
                  src={getImageUrl(model.imageUrl)} 
                  alt={model.name}
                  loading="lazy"
                />
                <div className="model-info">
                  <h3>{model.namePl || model.name}</h3>
                  <p className="price">{model.basePrice.toLocaleString()} PLN</p>
                  
                  {/* Характеристики */}
                  <div className="specs">
                    {model.capacity && (
                      <span className="spec">👥 {model.capacity} osób</span>
                    )}
                    {model.steamRoomSize && (
                      <span className="spec">🔥 Парная: {model.steamRoomSize}</span>
                    )}
                    {model.relaxRoomSize && (
                      <span className="spec">🛋️ Отдых: {model.relaxRoomSize}</span>
                    )}
                  </div>
                  
                  {/* Скидка */}
                  {model.discount > 0 && (
                    <span className="discount">-{model.discount}%</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Варианты модели */}
      {selectedModel?.variants?.length > 0 && (
        <section className="variants-section">
          <h2>Выберите вариант</h2>
          <div className="variants-grid">
            {selectedModel.variants.map(variant => (
              <div
                key={variant.id}
                className={`variant-card ${selectedVariant?.id === variant.id ? 'selected' : ''}`}
                onClick={() => setSelectedVariant(variant)}
              >
                {variant.imageUrl && (
                  <img src={getImageUrl(variant.imageUrl)} alt={variant.name} />
                )}
                <h4>{variant.namePl || variant.name}</h4>
                {variant.price !== 0 && (
                  <span className="price-diff">
                    {variant.price > 0 ? '+' : ''}{variant.price} PLN
                  </span>
                )}
                {variant.hint && <p className="hint">{variant.hint}</p>}
                
                {/* Характеристики варианта */}
                <div className="variant-specs">
                  {variant.terraceSize && <span>Терраса: {variant.terraceSize}</span>}
                  {variant.relaxRoomSize && <span>Отдых: {variant.relaxRoomSize}</span>}
                  {variant.steamRoomSize && <span>Парная: {variant.steamRoomSize}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Опции */}
      {selectedModel && data.categories
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map(category => (
          <section key={category.id} className="category-section">
            <h2>{category.namePl || category.name}</h2>
            {category.hint && <p className="category-hint">{category.hint}</p>}
            
            <div className="options-grid">
              {category.options
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                .map(option => (
                  <div
                    key={option.id}
                    className={`option-card ${selectedOptions[category.id]?.id === option.id ? 'selected' : ''}`}
                    onClick={() => handleOptionSelect(category.id, option)}
                  >
                    {option.imageUrl && (
                      <img src={getImageUrl(option.imageUrl)} alt={option.name} />
                    )}
                    <h4>{option.namePl || option.name}</h4>
                    <span className="price">
                      {option.price > 0 ? `+${option.price} PLN` : 'W zestawie'}
                    </span>
                    {option.hint && <p className="hint">{option.hint}</p>}
                  </div>
                ))}
            </div>
          </section>
        ))}

      {/* Итого */}
      <section className="total-section">
        <div className="total-card">
          <h2>Итого</h2>
          {selectedModel && (
            <>
              <p className="model-name">{selectedModel.namePl || selectedModel.name}</p>
              {selectedVariant && (
                <p className="variant-name">{selectedVariant.namePl || selectedVariant.name}</p>
              )}
            </>
          )}
          <p className="total-price">
            {calculateTotal().toLocaleString()} PLN
            {selectedModel?.discount > 0 && (
              <span className="discount-note"> (скидка {selectedModel.discount}%)</span>
            )}
          </p>
        </div>
      </section>
    </div>
  );
}

export default SaunaCalculator;
```

---

## 🎨 CSS стили (пример)

```css
.sauna-calculator {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.models-grid, .variants-grid, .options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.model-card, .variant-card, .option-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.model-card:hover, .variant-card:hover, .option-card:hover {
  border-color: #3498db;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.model-card.selected, .variant-card.selected, .option-card.selected {
  border-color: #2ecc71;
  background: #f0fff4;
}

.model-card img, .variant-card img, .option-card img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 10px;
}

.price {
  color: #2ecc71;
  font-weight: bold;
  font-size: 1.2em;
}

.discount {
  background: #e74c3c;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.specs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.spec {
  background: #f0f0f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85em;
}

.total-section {
  position: sticky;
  bottom: 20px;
  margin-top: 40px;
}

.total-card {
  background: linear-gradient(135deg, #2c3e50, #3498db);
  color: white;
  padding: 30px;
  border-radius: 16px;
  text-align: center;
}

.total-price {
  font-size: 2em;
  font-weight: bold;
}

.hint {
  color: #666;
  font-size: 0.9em;
  margin-top: 8px;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  font-size: 1.2em;
}
```

---

## 🔒 CORS

API поддерживает CORS для всех доменов, вызовы с любого сайта будут работать.

---

## 📞 Поддержка

При возникновении вопросов по API: admin@wm-kalkulator.pl
