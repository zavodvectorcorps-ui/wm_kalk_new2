import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { 
  User, Phone, MapPin, Calendar, Package, Flame, 
  DollarSign, FileText, CheckCircle2, Gift, Percent, Shield
} from 'lucide-react';

export const OrderPreviewModal = ({ 
  open, 
  onOpenChange, 
  order, 
  calculatorType = 'balia' 
}) => {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  
  const isSauna = calculatorType === 'sauna';
  
  const texts = {
    ru: {
      orderDetails: 'Детали заказа',
      customerInfo: 'Информация о клиенте',
      selectedModel: 'Выбранная модель',
      selectedOptions: 'Выбранные опции',
      summary: 'Итого',
      basePrice: 'Базовая цена',
      optionsTotal: 'Опции',
      discount: 'Скидка',
      gift: 'Подарок',
      total: 'Всего к оплате',
      notes: 'Примечания',
      noOptions: 'Нет выбранных опций',
      orderDate: 'Дата заказа',
      orderNumber: 'Номер заказа',
      createdBy: 'Сотрудник',
      included: 'В комплекте',
      promotion: 'Промоция',
      promotionDiscount: 'Скидка',
      promotionGift: 'Подарок',
      adminDiscountApproved: 'Скидка одобрена администратором',
      approvedBy: 'Одобрил',
    },
    pl: {
      orderDetails: 'Szczegóły zamówienia',
      customerInfo: 'Dane klienta',
      selectedModel: 'Wybrany model',
      selectedOptions: 'Wybrane opcje',
      summary: 'Podsumowanie',
      basePrice: 'Cena bazowa',
      optionsTotal: 'Opcje',
      discount: 'Rabat',
      gift: 'Prezent',
      total: 'Do zapłaty',
      notes: 'Uwagi',
      noOptions: 'Brak wybranych opcji',
      orderDate: 'Data zamówienia',
      orderNumber: 'Numer zamówienia',
      createdBy: 'Pracownik',
      included: 'W zestawie',
      adminDiscountApproved: 'Rabat zatwierdzony przez administratora',
      approvedBy: 'Zatwierdził',
      promotion: 'Promocja',
      promotionDiscount: 'Rabat',
      promotionGift: 'Prezent',
    },
  };
  const txt = texts[lang === 'pl' ? 'pl' : 'ru'];
  
  if (!order) return null;
  
  const currency = isSauna ? 'PLN' : '€';
  const Icon = isSauna ? Flame : Package;
  const themeColor = isSauna ? 'green' : 'blue';
  
  const formatPrice = (price) => {
    if (isSauna) {
      return `${(price || 0).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ${currency}`;
    }
    return `${(price || 0).toFixed(2)} ${currency}`;
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get options list
  const getOptionsList = () => {
    if (isSauna) {
      // Sauna has selectedOptions array
      return order.selectedOptions || [];
    } else {
      // Balia has selections object and selectedOptions
      return order.selectedOptions || [];
    }
  };

  const options = getOptionsList();
  const modelPrice = order.modelPrice || order.basePrice || 0;
  const optionsTotal = options.reduce((sum, opt) => sum + (opt.price || 0), 0);
  const discountAmount = order.discountPercent ? (modelPrice + optionsTotal) * order.discountPercent / 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className={`h-6 w-6 text-${themeColor}-600`} />
            {txt.orderDetails}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Order Header */}
          <div className={`p-4 rounded-lg bg-${themeColor}-50 border border-${themeColor}-200`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{txt.orderNumber}</p>
                <p className="font-mono font-bold text-lg">{order.id || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{txt.orderDate}</p>
                <p className="font-medium">{formatDate(order.orderDate)}</p>
              </div>
              {/* Promotion badge for Sauna - show discount or gift based on discountPercent */}
              {isSauna && (
                order.discountPercent > 0 ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    <Percent className="h-3 w-3 mr-1" />
                    {txt.promotionDiscount} {order.discountPercent}%
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-700">
                    <Gift className="h-3 w-3 mr-1" />
                    {txt.promotionGift}
                  </Badge>
                )
              )}
              {/* Promotion badges for Balia - original logic */}
              {!isSauna && order.discountPercent > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  <Percent className="h-3 w-3 mr-1" />
                  {txt.discount} {order.discountPercent}%
                </Badge>
              )}
              {!isSauna && order.giftDescription && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  <Gift className="h-3 w-3 mr-1" />
                  {txt.gift}
                </Badge>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <User className={`h-5 w-5 text-${themeColor}-600`} />
              {txt.customerInfo}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">ФИО / Imię</p>
                  <p className="font-medium">{order.fullName || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Телефон / Telefon</p>
                  <p className="font-medium">{order.phoneNumber || '-'}</p>
                </div>
              </div>
              {order.fullAddress && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Адрес / Adres</p>
                    <p className="font-medium">{order.fullAddress}</p>
                  </div>
                </div>
              )}
              {order.createdBy && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{txt.createdBy}</p>
                    <p className="font-medium">{order.createdBy}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Selected Model */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Icon className={`h-5 w-5 text-${themeColor}-600`} />
              {txt.selectedModel}
            </h3>
            <div className={`p-4 border-2 border-${themeColor}-200 rounded-lg bg-white`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-lg">{order.modelName || '-'}</p>
                  {order.modelId && (
                    <p className="text-sm text-muted-foreground">ID: {order.modelId}</p>
                  )}
                </div>
                <p className={`text-xl font-bold text-${themeColor}-600`}>
                  {formatPrice(modelPrice)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Selected Options */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <CheckCircle2 className={`h-5 w-5 text-${themeColor}-600`} />
              {txt.selectedOptions}
            </h3>
            {options.length > 0 ? (
              <div className="space-y-2">
                {options.map((opt, index) => {
                  const adminGifts = order.adminGifts || [];
                  const isAdminGift = adminGifts.includes(opt.optionId || opt.id);
                  
                  return (
                    <div 
                      key={opt.optionId || opt.id || index} 
                      className={`flex justify-between items-center p-3 rounded-lg ${
                        isAdminGift ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{opt.optionName || opt.name || '-'}</p>
                          <p className="text-sm text-muted-foreground">
                            {opt.categoryName || opt.category || ''}
                          </p>
                        </div>
                        {isAdminGift && (
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                            <Gift className="h-3 w-3 mr-1" />
                            {txt.giftFromAdmin || 'Подарок'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        {isAdminGift ? (
                          <>
                            <p className="font-semibold line-through text-muted-foreground text-sm">
                              {formatPrice(opt.price)}
                            </p>
                            <p className="font-bold text-green-600">0 {currency}</p>
                          </>
                        ) : (
                          <p className={`font-semibold ${opt.price > 0 ? `text-${themeColor}-600` : 'text-gray-500'}`}>
                            {opt.price > 0 ? `+${formatPrice(opt.price)}` : txt.included}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">{txt.noOptions}</p>
            )}
          </div>

          {/* Gift Description */}
          {order.giftDescription && (
            <>
              <Separator />
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Gift className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700">{txt.gift}</p>
                    <p className="text-red-600">{order.giftDescription}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <FileText className={`h-5 w-5 text-${themeColor}-600`} />
                  {txt.notes}
                </h3>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{order.notes}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Summary / Total */}
          <div className={`p-4 rounded-lg bg-${themeColor}-50 border-2 border-${themeColor}-300`}>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <DollarSign className={`h-5 w-5 text-${themeColor}-600`} />
              {txt.summary}
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{txt.basePrice}</span>
                <span className="font-medium">{formatPrice(modelPrice)}</span>
              </div>
              {optionsTotal > 0 && (
                <div className="flex justify-between">
                  <span>{txt.optionsTotal}</span>
                  <span className="font-medium">+{formatPrice(optionsTotal)}</span>
                </div>
              )}
              {/* Promotion info for Sauna */}
              {isSauna && (
                <div className={`flex justify-between ${order.discountPercent > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  <span className="flex items-center gap-1">
                    {order.discountPercent > 0 ? (
                      <>
                        <Percent className="h-4 w-4" />
                        {txt.promotion}: {txt.promotionDiscount} ({order.discountPercent}%)
                      </>
                    ) : (
                      <>
                        <Gift className="h-4 w-4" />
                        {txt.promotion}: {txt.promotionGift}
                      </>
                    )}
                  </span>
                  {order.discountPercent > 0 && (
                    <span className="font-medium">-{formatPrice(discountAmount)}</span>
                  )}
                </div>
              )}
              {/* Discount info for Balia (original logic) */}
              {!isSauna && discountAmount > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>{txt.discount} ({order.discountPercent}%)</span>
                  <span className="font-medium">-{formatPrice(discountAmount)}</span>
                </div>
              )}
              {/* Admin discount approved badge */}
              {order.adminDiscountApproved && (
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-green-700">
                    {txt.adminDiscountApproved}
                    {order.adminDiscountApprovedBy && (
                      <span className="ml-1">({txt.approvedBy}: {order.adminDiscountApprovedBy})</span>
                    )}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xl font-bold pt-2">
                <span>{txt.total}</span>
                <span className={`text-${themeColor}-700`}>
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderPreviewModal;
