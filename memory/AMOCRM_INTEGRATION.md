# Интеграция amoCRM с Калькулятором

## Способ 1: Добавление кнопки в карточку сделки amoCRM

### Шаг 1: Создание цифровой воронки
1. В amoCRM перейдите в **Настройки → Воронки**
2. Выберите нужную воронку или создайте новую
3. Нажмите на **шестерёнку** рядом с названием этапа
4. Выберите **Добавить действие → Виджет**

### Шаг 2: Создание виджета с ссылкой

Можно использовать **виджет "Кнопка"** или создать **Salesbot** со ссылкой:

#### Вариант A: Используя Salesbot
1. Перейдите в **Настройки → Salesbot**
2. Создайте нового бота
3. Добавьте действие **"Отправить сообщение"**
4. В сообщении добавьте ссылку:

```
Открыть калькулятор Balia: 
{{app_url}}/?calc=balia&amocrm_id={{lead.id}}

Открыть калькулятор Sauna:
{{app_url}}/?calc=sauna&amocrm_id={{lead.id}}
```

Где `{{app_url}}` - это URL вашего приложения:
`https://sauna-logistics.preview.emergentagent.com`

#### Вариант B: Добавление кнопки через цифровую воронку
1. В настройках этапа воронки добавьте **Webhook**
2. URL: `https://sauna-logistics.preview.emergentagent.com/?calc=balia&amocrm_id={{lead.id}}`

### Шаг 3: Добавление кнопки в карточку (через виджет)

Если у вас есть доступ к разработке виджетов amoCRM:

```javascript
// widget/script.js
define(['jquery'], function($) {
  var CustomWidget = function() {
    var self = this;
    
    this.callbacks = {
      render: function() {
        return true;
      },
      
      init: function() {
        return true;
      },
      
      bind_actions: function() {
        return true;
      },
      
      leads: {
        selected: function() {
          var lead_id = AMOCRM.data.current_card.id;
          var app_url = 'https://sauna-logistics.preview.emergentagent.com';
          
          // Добавляем кнопки в карточку
          if ($('#calculator-buttons').length === 0) {
            var buttons = `
              <div id="calculator-buttons" style="margin: 10px 0;">
                <a href="${app_url}/?calc=balia&amocrm_id=${lead_id}" 
                   target="_blank" 
                   class="button-input button-input_blue"
                   style="margin-right: 10px;">
                  Калькулятор Balia
                </a>
                <a href="${app_url}/?calc=sauna&amocrm_id=${lead_id}" 
                   target="_blank" 
                   class="button-input button-input_orange">
                  Калькулятор Sauna
                </a>
              </div>
            `;
            $('.card-widgets__widget-wrapper').first().before(buttons);
          }
        }
      }
    };
    return this;
  };
  return CustomWidget;
});
```

## Способ 2: Простая ссылка (без виджета)

Менеджер может открывать калькулятор по ссылке, подставляя ID сделки:

### Balia калькулятор:
```
https://sauna-logistics.preview.emergentagent.com/?calc=balia&amocrm_id=ID_СДЕЛКИ
```

### Sauna калькулятор:
```
https://sauna-logistics.preview.emergentagent.com/?calc=sauna&amocrm_id=ID_СДЕЛКИ
```

Замените `ID_СДЕЛКИ` на номер сделки из amoCRM.

## Что происходит при открытии ссылки

1. Калькулятор автоматически откроется на нужном типе (Balia или Sauna)
2. Данные клиента загрузятся из amoCRM:
   - Имя клиента
   - Телефон
   - Адрес (если заполнен)
3. После создания заказа в калькуляторе:
   - В amoCRM добавится примечание "✅ КП создано"
   - В заказе сохранится ссылка на сделку amoCRM

## Требования

1. В настройках интеграции amoCRM должны быть указаны:
   - Домен amoCRM (например: `yourcompany.amocrm.ru`)
   - API-токен (долгосрочный токен)
   - Маппинг полей для каждой секции

2. Пользователь должен быть авторизован в приложении калькулятора
