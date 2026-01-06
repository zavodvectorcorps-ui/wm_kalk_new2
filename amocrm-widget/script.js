define(['jquery'], function($) {
  var CustomWidget = function() {
    var self = this;
    var settings = {};
    
    // Widget settings
    this.getApiUrl = function() {
      return self.get_settings().api_url || 'https://wm-kalkulator.pl/api';
    };
    
    this.getAppUrl = function() {
      return self.get_settings().app_url || 'https://wm-kalkulator.pl';
    };

    // Render delivery status in lead card
    this.renderDeliveryStatus = function(leadId) {
      var $container = $('[data-id="wm_delivery_status"]');
      if (!$container.length) return;
      
      $container.html('<div class="wm-loading">Загрузка...</div>');
      
      $.ajax({
        url: self.getApiUrl() + '/widget/delivery-status/' + leadId,
        method: 'GET',
        success: function(data) {
          if (!data.found) {
            $container.html('<div class="wm-not-found">Заказ не найден в логистике</div>');
            return;
          }
          
          var html = '<div class="wm-delivery-widget">';
          
          // Status badge
          html += '<div class="wm-status" style="background-color: ' + data.status.color + '20; color: ' + data.status.color + '; border: 1px solid ' + data.status.color + '">';
          html += '<span class="wm-status-dot" style="background-color: ' + data.status.color + '"></span>';
          html += data.status.label;
          html += '</div>';
          
          // Trip info
          if (data.trip) {
            html += '<div class="wm-trip-info">';
            html += '<div class="wm-trip-row"><span class="wm-label">Рейс:</span> ' + (data.trip.name || '-') + '</div>';
            html += '<div class="wm-trip-row"><span class="wm-label">Водитель:</span> ' + (data.trip.driverName || 'Не назначен') + '</div>';
            if (data.trip.departureDate) {
              var date = new Date(data.trip.departureDate);
              html += '<div class="wm-trip-row"><span class="wm-label">Дата:</span> ' + date.toLocaleDateString('ru-RU') + '</div>';
            }
            html += '</div>';
          }
          
          // Delivery confirmation
          if (data.delivery && data.delivery.confirmedAt) {
            html += '<div class="wm-delivery-confirmed">';
            html += '<div class="wm-confirmed-badge">✓ Доставлено</div>';
            if (data.delivery.receivedAmount) {
              html += '<div class="wm-trip-row"><span class="wm-label">Получено:</span> ' + data.delivery.receivedAmount + '</div>';
            }
            if (data.delivery.photo && data.delivery.photo.hasPhoto) {
              html += '<a href="#" class="wm-view-photo" data-lead="' + leadId + '">📷 Посмотреть фото акта</a>';
            }
            html += '</div>';
          }
          
          html += '</div>';
          
          $container.html(html);
          
          // Photo click handler
          $container.find('.wm-view-photo').on('click', function(e) {
            e.preventDefault();
            self.showDeliveryPhoto(leadId);
          });
        },
        error: function() {
          $container.html('<div class="wm-error">Ошибка загрузки данных</div>');
        }
      });
    };
    
    // Show delivery photo in modal
    this.showDeliveryPhoto = function(leadId) {
      $.ajax({
        url: self.getApiUrl() + '/widget/delivery-photo/' + leadId,
        method: 'GET',
        success: function(data) {
          if (data.photoUrl) {
            var modal = $('<div class="wm-photo-modal">' +
              '<div class="wm-photo-overlay"></div>' +
              '<div class="wm-photo-content">' +
              '<img src="' + data.photoUrl + '" alt="Фото акта">' +
              '<div class="wm-photo-info">Загружено: ' + (data.uploadedBy || '') + '</div>' +
              '<button class="wm-photo-close">✕</button>' +
              '</div></div>');
            
            $('body').append(modal);
            
            modal.find('.wm-photo-overlay, .wm-photo-close').on('click', function() {
              modal.remove();
            });
          }
        },
        error: function() {
          alert('Не удалось загрузить фото');
        }
      });
    };
    
    // Render calculator selector in sidebar
    this.renderCalculatorSelector = function(leadId) {
      var $container = $('[data-id="wm_calculator_selector"]');
      if (!$container.length) return;
      
      var html = '<div class="wm-calc-widget">';
      html += '<div class="wm-calc-title">Открыть калькулятор</div>';
      html += '<div class="wm-calc-buttons">';
      html += '<button class="wm-calc-btn wm-calc-balia" data-calc="balia" data-lead="' + leadId + '">';
      html += '<span class="wm-calc-icon">🛁</span> Купель';
      html += '</button>';
      html += '<button class="wm-calc-btn wm-calc-sauna" data-calc="sauna" data-lead="' + leadId + '">';
      html += '<span class="wm-calc-icon">🔥</span> Сауна';
      html += '</button>';
      html += '<button class="wm-calc-btn wm-calc-greenhouse" data-calc="greenhouse" data-lead="' + leadId + '">';
      html += '<span class="wm-calc-icon">🌿</span> Теплица';
      html += '</button>';
      html += '</div>';
      html += '</div>';
      
      $container.html(html);
      
      // Button click handlers
      $container.find('.wm-calc-btn').on('click', function() {
        var calc = $(this).data('calc');
        var lead = $(this).data('lead');
        self.openCalculator(calc, lead);
      });
    };
    
    // Open calculator in popup
    this.openCalculator = function(calculator, leadId) {
      var url = self.getAppUrl() + '/?amocrm_lead=' + leadId + '&section=' + calculator + '&source=widget';
      
      // Open in popup window
      var width = 1200;
      var height = 800;
      var left = (screen.width - width) / 2;
      var top = (screen.height - height) / 2;
      
      window.open(
        url,
        'wm_calculator',
        'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes'
      );
    };

    // Widget callbacks
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
      
      settings: function() {
        return true;
      },
      
      onSave: function() {
        return true;
      },
      
      // Lead card render
      leads: {
        selected: function() {
          var leadId = AMOCRM.data.current_card.id;
          
          // Wait for DOM and render widgets
          setTimeout(function() {
            // Check if our container exists, if not create it
            if (!$('[data-id="wm_delivery_status"]').length) {
              var $widget = $('<div class="wm-widget-container" data-id="wm_delivery_status"></div>');
              $('.card-widgets__widget-item:first').after($widget);
            }
            
            self.renderDeliveryStatus(leadId);
          }, 500);
          
          return true;
        }
      },
      
      // Advanced settings
      advancedSettings: function() {
        return true;
      }
    };

    return this;
  };

  return CustomWidget;
});
