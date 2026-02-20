define(['jquery'], function($) {
  var CustomWidget = function() {
    var self = this;
    
    // Widget settings
    this.getApiUrl = function() {
      return self.get_settings().api_url || 'https://wm-kalkulator.pl/api';
    };
    
    this.getAppUrl = function() {
      return self.get_settings().app_url || 'https://wm-kalkulator.pl';
    };

    // Render delivery status in lead card
    this.renderDeliveryStatus = function(leadId) {
      var $container = $('#wm_delivery_status');
      if (!$container.length) {
        // Create container in card widgets area
        var $widgetsArea = $('.card-widgets');
        if ($widgetsArea.length) {
          $widgetsArea.prepend('<div id="wm_delivery_status" class="wm-widget-container"></div>');
          $container = $('#wm_delivery_status');
        } else {
          return;
        }
      }
      
      $container.html('<div class="wm-loading">Загрузка статуса доставки...</div>');
      
      $.ajax({
        url: self.getApiUrl() + '/widget/delivery-status/' + leadId,
        method: 'GET',
        success: function(data) {
          if (!data.found) {
            $container.html('<div class="wm-delivery-widget"><div class="wm-not-found">Заказ не найден в логистике</div></div>');
            return;
          }
          
          var html = '<div class="wm-delivery-widget">';
          html += '<div class="wm-widget-title">🚛 Статус доставки</div>';
          
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
          } else {
            html += '<div class="wm-trip-info">';
            html += '<div class="wm-trip-row wm-no-trip">Не добавлен в рейс</div>';
            html += '</div>';
          }
          
          // Delivery confirmation
          if (data.delivery && data.delivery.confirmedAt) {
            html += '<div class="wm-delivery-confirmed">';
            html += '<div class="wm-confirmed-badge">✓ Доставлено</div>';
            if (data.delivery.receivedAmount) {
              html += '<div class="wm-trip-row"><span class="wm-label">Получено:</span> ' + data.delivery.receivedAmount + '</div>';
            }
            var confirmDate = new Date(data.delivery.confirmedAt);
            html += '<div class="wm-trip-row"><span class="wm-label">Время:</span> ' + confirmDate.toLocaleString('ru-RU') + '</div>';
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
          $container.html('<div class="wm-delivery-widget"><div class="wm-error">Ошибка загрузки данных</div></div>');
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
    
    // Render calculator selector in right sidebar
    this.renderCalculatorSelector = function(leadId) {
      var $container = $('#wm_calculator_selector');
      if (!$container.length) return;
      
      // First, check for existing orders
      $.ajax({
        url: self.getApiUrl() + '/widget/orders-status/' + leadId,
        method: 'GET',
        success: function(data) {
          var html = '<div class="wm-calc-widget">';
          
          // Show existing orders with edit buttons
          if (data.orders && Object.keys(data.orders).length > 0) {
            html += '<div class="wm-existing-orders">';
            html += '<div class="wm-section-title">📋 Существующие заказы</div>';
            
            var sectionIcons = { sauna: '🔥', balia: '🛁', greenhouse: '🌿' };
            var sectionNames = { sauna: 'Сауна', balia: 'Купель', greenhouse: 'Теплица' };
            var calcPaths = { sauna: 'sauna', balia: 'balia', greenhouse: 'greenhouse' };
            
            for (var section in data.orders) {
              var order = data.orders[section];
              html += '<div class="wm-order-item">';
              html += '<div class="wm-order-info">';
              html += '<span class="wm-order-icon">' + (sectionIcons[section] || '📦') + '</span>';
              html += '<span class="wm-order-name">' + (sectionNames[section] || section) + '</span>';
              html += '<span class="wm-order-total">' + (order.total ? order.total.toLocaleString('pl-PL') + ' zł' : '') + '</span>';
              html += '</div>';
              html += '<div class="wm-order-actions">';
              html += '<button class="wm-edit-btn" data-calc="' + calcPaths[section] + '" data-order="' + order.id + '" data-lead="' + leadId + '">✏️</button>';
              html += '<button class="wm-view-btn" data-calc="' + calcPaths[section] + '" data-order="' + order.id + '" data-lead="' + leadId + '">👁️</button>';
              html += '</div>';
              html += '</div>';
            }
            html += '</div>';
          }
          
          // New order buttons
          html += '<div class="wm-section-title">➕ Создать новый заказ</div>';
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
          
          // Edit button handlers
          $container.find('.wm-edit-btn').on('click', function() {
            var calc = $(this).data('calc');
            var orderId = $(this).data('order');
            self.openOrderEdit(calc, orderId);
          });
          
          // View button handlers
          $container.find('.wm-view-btn').on('click', function() {
            var calc = $(this).data('calc');
            var orderId = $(this).data('order');
            self.openOrderView(calc, orderId);
          });
          
          // New order button handlers
          $container.find('.wm-calc-btn').on('click', function() {
            var calc = $(this).data('calc');
            var lead = $(this).data('lead');
            self.openCalculator(calc, lead);
          });
        },
        error: function() {
          // Fallback - show just new order buttons
          var html = '<div class="wm-calc-widget">';
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
          
          $container.find('.wm-calc-btn').on('click', function() {
            var calc = $(this).data('calc');
            var lead = $(this).data('lead');
            self.openCalculator(calc, lead);
          });
        }
      });
    };
    
    // Open order for editing
    this.openOrderEdit = function(calculator, orderId) {
      var url = self.getAppUrl() + '/' + calculator + '/calculator?edit=' + orderId;
      
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
    
    // Open order for viewing
    this.openOrderView = function(calculator, orderId) {
      var url = self.getAppUrl() + '/' + calculator + '/calculator?view=' + orderId;
      
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
        // Render in right sidebar (ccard location)
        var leadId = null;
        
        if (AMOCRM.data.current_card && AMOCRM.data.current_card.id) {
          leadId = AMOCRM.data.current_card.id;
        }
        
        if (leadId) {
          setTimeout(function() {
            self.renderCalculatorSelector(leadId);
          }, 300);
        }
        
        return true;
      },
      
      init: function() {
        // Check if on lead card page
        if (self.system().area === 'lcard') {
          var leadId = AMOCRM.data.current_card.id;
          
          setTimeout(function() {
            self.renderDeliveryStatus(leadId);
          }, 500);
        }
        
        return true;
      },
      
      bind_actions: function() {
        return true;
      },
      
      settings: function() {
        var $settings = $('<div class="wm-settings">' +
          '<p>Для работы виджета укажите URL вашего приложения WM Kalkulator.</p>' +
          '<p>По умолчанию: https://wm-kalkulator.pl</p>' +
          '</div>');
        
        return $settings;
      },
      
      onSave: function() {
        return true;
      },
      
      destroy: function() {
        // Cleanup
      },
      
      advancedSettings: function() {
        return true;
      }
    };

    return this;
  };

  return CustomWidget;
});
