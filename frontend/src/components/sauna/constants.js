// Sauna Calculator Constants and Translations
import { 
  Flame, DoorOpen, Layers, Lightbulb, Package, Truck, Thermometer
} from 'lucide-react';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
export const API_URL = getApiUrl();

// Helper to get full image URL
export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `${API_URL}${url}`;
  return url;
};

// Category icons mapping
export const categoryIcons = {
  'Kolor': Layers,
  'Piece': Flame,
  'Strona Pieca:': Flame,
  'Zbiornik na wodę na piec': Thermometer,
  'Ogrodzenie do pieca (drewniane)': Package,
  'Drzwi': DoorOpen,
  'Lokalizacja drzwi': DoorOpen,
  'Okna': Layers,
  'Szyba połpanoramiczna': Layers,
  'Ławki': Layers,
  'Oswietlenie': Lightbulb,
  'Opcje Dodatkowe': Package,
  'Belki podłużne do podstawy ramy sauny': Package,
  'Dostawa': Truck,
};

// Translations
export const translations = {
  ru: {
    saunaCalculator: 'Калькулятор саун',
    customerInfo: 'Данные клиента',
    fullName: 'Имя и фамилия',
    email: 'Email',
    phoneNumber: 'Телефон',
    fullAddress: 'Полный адрес',
    orderDate: 'Дата заказа',
    selectModel: 'Выберите модель сауны',
    model: 'Модель сауны',
    basePrice: 'Базовая цена',
    foundation: 'Фундамент',
    discount: 'Скидка',
    discountPercent: 'Скидка %',
    applyStandardDiscount: 'Стандартная скидка',
    certificatePayment: 'Оплата сертификатом',
    certificateApplied: 'Скидка сертификата применена: 13%',
    certificateRemoved: 'Скидка сертификата убрана',
    noDiscountForModel: 'Для этой модели нет стандартной скидки',
    discountApplied: 'Скидка применена',
    notes: 'Комментарий к заказу',
    notesPlaceholder: 'Добавьте комментарий к заказу...',
    summary: 'Итог заказа',
    subtotal: 'Сумма опций',
    foundationPrice: 'Стоимость фундамента',
    discountAmount: 'Сумма скидки',
    priceBeforeDiscount: 'Цена до скидки',
    priceAfterDiscount: 'Цена после скидки',
    youSave: 'Вы экономите',
    total: 'ИТОГО (брутто с VAT)',
    saveAndGeneratePDF: 'Сохранить и создать PDF',
    generatePDFOnly: 'Создать PDF',
    clearForm: 'Очистить форму',
    orderSaved: 'Заказ сауны сохранён!',
    pdfGenerated: 'PDF успешно создан!',
    formCleared: 'Форма очищена',
    fillRequired: 'Заполните обязательные поля',
    selectModelFirst: 'Сначала выберите модель',
    gratis: 'в комплекте',
    quantity: 'Кол-во',
    priceDepends: 'цена зависит от модели',
    editingOrder: 'Редактирование заказа',
    cancel: 'Отмена',
    saveChangesAndPdf: 'Обновить КП и скачать PDF',
    cancelEdit: 'Отменить редактирование',
    orderUpdated: 'КП обновлено!',
    createNewKp: 'Создать новое КП',
    newKpCreated: 'Создано новое КП!',
    adminApproveDiscount: 'Одобряю скидку как администратор',
    requestedDiscount: 'Запрашиваемая скидка',
    requestedDiscountHint: 'Если клиенту нужна скидка больше 10%, введите здесь. Администратор увидит этот запрос.',
    requestComment: 'Комментарий к запросу...',
    gifts: 'Подарки',
    giftsHint: 'Опции, отмеченные как подарок, бесплатны',
    // Category translations
    'Kolor': 'Цвет / Пропитка',
    'Piece': 'Печь',
    'Strona Pieca:': 'Расположение печи',
    'Zbiornik na wodę na piec': 'Бак для воды на печь',
    'Ogrodzenie do pieca (drewniane)': 'Ограждение печи (деревянное)',
    'Drzwi': 'Двери',
    'Lokalizacja drzwi': 'Расположение дверей',
    'Okna': 'Окна',
    'Szyba połpanoramiczna': 'Панорамное стекло',
    'Ławki': 'Лавки',
    'Oswietlenie': 'Освещение',
    'Opcje Dodatkowe': 'Дополнительные опции',
    'Belki podłużne do podstawy ramy sauny': 'Балки для фундамента',
    'Dostawa': 'Доставка',
  },
  pl: {
    saunaCalculator: 'Kalkulator saun',
    customerInfo: 'Dane klienta',
    fullName: 'Imię i nazwisko',
    email: 'Email',
    phoneNumber: 'Telefon',
    fullAddress: 'Adres',
    orderDate: 'Data zamówienia',
    selectModel: 'Wybierz model sauny',
    model: 'Model sauny',
    basePrice: 'Cena podstawowa',
    foundation: 'Fundament',
    discount: 'Rabat',
    discountPercent: 'Rabat %',
    applyStandardDiscount: 'Standardowa zniżka',
    certificatePayment: 'Płatność certyfikatem',
    certificateApplied: 'Rabat certyfikatu zastosowany: 13%',
    certificateRemoved: 'Rabat certyfikatu usunięty',
    noDiscountForModel: 'Dla tego modelu nie ma zdefiniowanej standardowej zniżki',
    discountApplied: 'Rabat zastosowany',
    notes: 'Komentarz do zamówienia',
    notesPlaceholder: 'Dodaj komentarz do zamówienia...',
    summary: 'Podsumowanie zamówienia',
    subtotal: 'Suma opcji',
    foundationPrice: 'Koszt fundamentu',
    discountAmount: 'Kwota rabatu',
    priceBeforeDiscount: 'Cena przed rabatem',
    priceAfterDiscount: 'Cena po rabacie',
    youSave: 'Oszczędzasz',
    total: 'RAZEM (brutto z VAT)',
    saveAndGeneratePDF: 'Zapisz i generuj PDF',
    generatePDFOnly: 'Generuj PDF',
    clearForm: 'Wyczyść formularz',
    orderSaved: 'Zamówienie sauny zapisane!',
    pdfGenerated: 'PDF wygenerowany!',
    formCleared: 'Formularz wyczyszczony',
    fillRequired: 'Wypełnij wymagane pola',
    selectModelFirst: 'Najpierw wybierz model',
    gratis: 'w zestawie',
    quantity: 'Ilość',
    priceDepends: 'cena zależy od modelu',
    editingOrder: 'Edycja zamówienia',
    cancel: 'Anuluj',
    saveChangesAndPdf: 'Zaktualizuj KP i pobierz PDF',
    cancelEdit: 'Anuluj edycję',
    orderUpdated: 'KP zaktualizowane!',
    createNewKp: 'Utwórz nowe KP',
    newKpCreated: 'Utworzono nowe KP!',
    adminApproveDiscount: 'Zatwierdzam rabat jako administrator',
    requestedDiscount: 'Wnioskowany rabat',
    requestedDiscountHint: 'Jeśli klient potrzebuje rabatu większego niż 10%, wpisz tutaj. Administrator zobaczy ten wniosek.',
    requestComment: 'Komentarz do wniosku...',
    gifts: 'Prezenty',
    giftsHint: 'Opcje oznaczone jako prezent są darmowe',
    // Category translations (keep Polish names)
    'Kolor': 'Kolor / Impregnacja',
    'Piece': 'Piec',
    'Strona Pieca:': 'Strona pieca',
    'Zbiornik na wodę na piec': 'Zbiornik na wodę na piec',
    'Ogrodzenie do pieca (drewniane)': 'Ogrodzenie do pieca (drewniane)',
    'Drzwi': 'Drzwi',
    'Lokalizacja drzwi': 'Lokalizacja drzwi',
    'Okna': 'Okna',
    'Szyba połpanoramiczna': 'Szyba półpanoramiczna',
    'Ławki': 'Ławki',
    'Oswietlenie': 'Oświetlenie',
    'Opcje Dodatkowe': 'Opcje dodatkowe',
    'Belki podłużne do podstawy ramy sauny': 'Belki podłużne do podstawy ramy sauny',
    'Dostawa': 'Dostawa',
  },
};

// Get translation helper
export const getTranslation = (lang) => translations[lang === 'pl' ? 'pl' : 'ru'];

// Format price helper
export const formatPrice = (price) => {
  return price.toLocaleString('pl-PL');
};

// Initial form state
export const getInitialFormData = () => ({
  fullName: '',
  email: '',
  phoneNumber: '',
  fullAddress: '',
  orderDate: new Date().toISOString().split('T')[0],
  selectedModel: '',
  selectedModelVariant: '', // For model variants (sub-models)
  selections: {},
  quantities: {},
  variantSelections: {}, // For option variants: { "optionId": "variantId" } - only one variant per option
  subSelections: {}, // Legacy - kept for backward compatibility
  openPrices: {}, // Prices entered by manager for open-price options: { "optionId": number }
  customOptions: [], // Free-form options added by manager: [{ id, name, price, quantity }]
  notes: '',
});
