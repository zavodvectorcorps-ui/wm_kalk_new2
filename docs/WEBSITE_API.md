# API для сайта — Модели саун

## Базовый URL
```
https://wm-kalkulator.pl/api/sauna
```

---

## 1. Список всех моделей
```
GET /api/sauna/public/models?lang=pl
```

**Параметры:**
- `lang` — язык (`pl` или `ru`, по умолчанию `pl`)

**Пример запроса:**
```javascript
const response = await fetch('https://wm-kalkulator.pl/api/sauna/public/models?lang=pl');
const data = await response.json();
// data.models — массив моделей
```

**Пример ответа:**
```json
{
  "models": [
    {
      "id": "sauna_kwadro_300",
      "name": "Sauna Kwadro 3m",
      "basePrice": 24100,
      "foundationPrice": 2500,
      "discount": 0,
      "imageUrl": "https://res.cloudinary.com/.../main_photo.jpg",
      "galleryImages": [
        "https://res.cloudinary.com/.../photo1.jpg",
        "https://res.cloudinary.com/.../photo2.jpg"
      ],
      "description": "Opis modelu dla strony internetowej...",
      "capacity": "4-6",
      "relaxRoomSize": "2.5 x 3.0 m",
      "steamRoomSize": "2.0 x 2.0 m",
      "layoutSize": "3m",
      "variants": [
        {
          "id": "variant_1",
          "name": "Wariant 1 — Standardowy",
          "price": 0,
          "imageUrl": "https://res.cloudinary.com/.../variant1.jpg",
          "description": "Standardowy układ 2 pomieszczenia",
          "category": "Prosta wejście",
          "capacity": "4-6",
          "terraceSize": "-",
          "relaxRoomSize": "2.5 x 3.0 m",
          "steamRoomSize": "2.0 x 2.0 m",
          "entranceSide": "Prawa"
        }
      ],
      "comparisonTable": {
        "headers": ["Wariant", "Osoby", "Pokój wypoczynkowy", "Pokój parowy", "Taras", "Wejście", "Cena"],
        "rows": [
          {
            "name": "Wariant 1",
            "capacity": "4-6",
            "relaxRoomSize": "2.5 x 3.0 m",
            "steamRoomSize": "2.0 x 2.0 m",
            "terraceSize": "-",
            "entranceSide": "Prawa",
            "price": 0
          }
        ]
      }
    }
  ],
  "lang": "pl"
}
```

---

## 2. Одна модель с полными данными (включая опции)
```
GET /api/sauna/public/models/{model_id}?lang=pl
```

**Пример:**
```javascript
const response = await fetch('https://wm-kalkulator.pl/api/sauna/public/models/sauna_kwadro_300?lang=pl');
const model = await response.json();
```

**Ответ — всё то же, что и в списке, плюс:**
```json
{
  "availableOptions": [
    {
      "id": "benches",
      "name": "Ławki",
      "options": [
        {
          "id": "bench_standard",
          "name": "Ławka standardowa",
          "price": 500,
          "imageUrl": "https://...",
          "variants": [
            {
              "id": "variant_1",
              "name": "Ławka prosta",
              "price": 500,
              "imageUrl": "https://..."
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 3. Как вытянуть данные на сайт

### WordPress (PHP)
```php
<?php
function get_sauna_models() {
    $url = 'https://wm-kalkulator.pl/api/sauna/public/models?lang=pl';
    $response = wp_remote_get($url, ['timeout' => 10]);
    
    if (is_wp_error($response)) return [];
    
    $body = json_decode(wp_remote_retrieve_body($response), true);
    return $body['models'] ?? [];
}

// Использование в шаблоне:
$models = get_sauna_models();
foreach ($models as $model) {
    echo '<div class="sauna-model">';
    echo '<h2>' . esc_html($model['name']) . '</h2>';
    echo '<img src="' . esc_url($model['imageUrl']) . '" alt="' . esc_attr($model['name']) . '">';
    echo '<p class="price">od ' . number_format($model['basePrice'], 0, ',', ' ') . ' PLN</p>';
    echo '<p>' . esc_html($model['description']) . '</p>';
    
    // Галерея
    if (!empty($model['galleryImages'])) {
        echo '<div class="gallery">';
        foreach ($model['galleryImages'] as $img) {
            echo '<img src="' . esc_url($img) . '" loading="lazy">';
        }
        echo '</div>';
    }
    
    // Варианты планировок
    if (!empty($model['variants'])) {
        echo '<h3>Warianty wykonania</h3>';
        echo '<div class="variants-grid">';
        foreach ($model['variants'] as $variant) {
            echo '<div class="variant-card">';
            if ($variant['imageUrl']) {
                echo '<img src="' . esc_url($variant['imageUrl']) . '" alt="' . esc_attr($variant['name']) . '">';
            }
            echo '<h4>' . esc_html($variant['name']) . '</h4>';
            if ($variant['description']) {
                echo '<p>' . esc_html($variant['description']) . '</p>';
            }
            // Доп. цена варианта
            if ($variant['price'] > 0) {
                echo '<span class="variant-price">+' . number_format($variant['price'], 0, ',', ' ') . ' PLN</span>';
            }
            echo '</div>';
        }
        echo '</div>';
    }
    
    // Сравнительная таблица
    if (!empty($model['comparisonTable'])) {
        $ct = $model['comparisonTable'];
        echo '<h3>Porównanie wariantów</h3>';
        echo '<table class="comparison-table">';
        echo '<thead><tr>';
        foreach ($ct['headers'] as $header) {
            echo '<th>' . esc_html($header) . '</th>';
        }
        echo '</tr></thead><tbody>';
        foreach ($ct['rows'] as $row) {
            echo '<tr>';
            echo '<td>' . esc_html($row['name']) . '</td>';
            echo '<td>' . esc_html($row['capacity']) . '</td>';
            echo '<td>' . esc_html($row['relaxRoomSize']) . '</td>';
            echo '<td>' . esc_html($row['steamRoomSize']) . '</td>';
            echo '<td>' . esc_html($row['terraceSize']) . '</td>';
            echo '<td>' . esc_html($row['entranceSide']) . '</td>';
            $price_str = $row['price'] > 0 ? '+' . number_format($row['price'], 0, ',', ' ') . ' PLN' : 'W cenie';
            echo '<td>' . esc_html($price_str) . '</td>';
            echo '</tr>';
        }
        echo '</tbody></table>';
    }
    
    echo '</div>';
}
?>
```

### JavaScript (любой сайт)
```html
<div id="sauna-models"></div>

<script>
async function loadSaunaModels() {
  const res = await fetch('https://wm-kalkulator.pl/api/sauna/public/models?lang=pl');
  const { models } = await res.json();
  
  const container = document.getElementById('sauna-models');
  
  models.forEach(model => {
    const html = `
      <div class="sauna-model">
        <img src="${model.imageUrl}" alt="${model.name}">
        <h2>${model.name}</h2>
        <p class="price">od ${model.basePrice.toLocaleString('pl-PL')} PLN</p>
        <p>${model.description || ''}</p>
        
        ${model.galleryImages?.length ? `
          <div class="gallery">
            ${model.galleryImages.map(img => `<img src="${img}" loading="lazy">`).join('')}
          </div>
        ` : ''}
        
        ${model.variants?.length ? `
          <h3>Warianty wykonania</h3>
          <div class="variants-grid">
            ${model.variants.map(v => `
              <div class="variant-card">
                ${v.imageUrl ? `<img src="${v.imageUrl}" alt="${v.name}">` : ''}
                <h4>${v.name}</h4>
                <p>${v.description || ''}</p>
                ${v.price > 0 ? `<span class="price">+${v.price.toLocaleString('pl-PL')} PLN</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${model.comparisonTable ? `
          <h3>Porównanie wariantów</h3>
          <table>
            <thead><tr>${model.comparisonTable.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
              ${model.comparisonTable.rows.map(r => `
                <tr>
                  <td>${r.name}</td>
                  <td>${r.capacity}</td>
                  <td>${r.relaxRoomSize}</td>
                  <td>${r.steamRoomSize}</td>
                  <td>${r.terraceSize}</td>
                  <td>${r.entranceSide}</td>
                  <td>${r.price > 0 ? '+' + r.price.toLocaleString('pl-PL') + ' PLN' : 'W cenie'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  });
}

loadSaunaModels();
</script>
```

---

## 4. CORS
API доступен с любого домена (заголовок `Access-Control-Allow-Origin: *`).
Данные кешируются на 5 минут.

## 5. Поле "Описание для сайта"
Заполняется в: **Панель управления → Sauna → Настройки цен → Модели → Редактировать модель → "Описание для сайта"**

Два поля:
- **Описание (PL)** — для польского сайта
- **Описание (RU)** — для русскоязычной версии

Если описание для сайта не заполнено, используется обычное "Описание / Подсказка" модели.
