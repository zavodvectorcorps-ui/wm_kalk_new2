// Technical specification options data for sauna production
// Based on the Excel file: Sauna tehkarta.xlsx

export const TECH_SPEC_CATEGORIES = [
  {
    id: 'base_color',
    name: 'Цвет базы',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'palisander', name: 'Палисандр' },
      { id: 'walnut', name: 'Орех' },
      { id: 'white', name: 'Белый' },
      { id: 'wenge', name: 'Венге' },
    ],
  },
  {
    id: 'door_color',
    name: 'Цвет дверей',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'palisander', name: 'Палисандр' },
      { id: 'walnut', name: 'Орех' },
      { id: 'white', name: 'Белый' },
      { id: 'wenge', name: 'Венге' },
    ],
  },
  {
    id: 'trim_color',
    name: 'Цвет наличника',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'palisander', name: 'Палисандр' },
      { id: 'walnut', name: 'Орех' },
      { id: 'white', name: 'Белый' },
      { id: 'wenge', name: 'Венге' },
    ],
  },
  {
    id: 'roof_color',
    name: 'Цвет крыши',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'brown', name: 'Коричневый' },
      { id: 'graphite', name: 'Графит' },
      { id: 'green', name: 'Зеленый' },
    ],
  },
  {
    id: 'benches',
    name: 'Ławki (Полки)',
    inputType: 'radio',
    layout: 'column',
    hasImages: true,
    options: [
      { id: 'standard_1', name: 'Standart (1 poziom)', imageUrl: 'https://i.imgur.com/ff4dvj5.jpeg' },
      { id: 'standard_corner_1', name: 'Standart kątowy (1 poziom)', imageUrl: 'https://i.imgur.com/EH6e0Oe.jpeg' },
      { id: 'open_2_55', name: 'Ławki 2-poziomowe nie są zamknięte 55 cm', imageUrl: 'https://i.imgur.com/lNi4r5Q.jpeg' },
      { id: 'premium_closed_2_55', name: 'Premium Ławki 2 poziomy zamknięte 55 cm', imageUrl: 'https://i.imgur.com/F8HtCTo.jpeg' },
      { id: 'premium_sliding_2_55', name: 'Premium Ławki 2 poziomy nie są zamknięte dolne przesuwane 55 cm', imageUrl: 'https://i.imgur.com/udSAwBt.jpeg' },
    ],
  },
  {
    id: 'shelf_size',
    name: 'Размер полков',
    inputType: 'text',
    layout: 'row',
    options: [
      { id: 'length', name: 'Длина', placeholder: 'например: 180 см' },
    ],
  },
  {
    id: 'stove_guard',
    name: 'Ограждение для печи',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'yes', name: 'Да' },
      { id: 'no', name: 'Нет' },
    ],
  },
  {
    id: 'stove_base',
    name: 'Основание для печи',
    inputType: 'checkbox',
    layout: 'column',
    options: [
      { id: 'stove_base', name: 'Основание для печи (всегда вкл)', required: true },
    ],
  },
  {
    id: 'drain',
    name: 'Трап',
    inputType: 'text',
    layout: 'column',
    options: [
      { id: 'steam_room', name: 'Трап в парной', placeholder: 'размер' },
      { id: 'hallway', name: 'Трап в КО', placeholder: 'размер' },
    ],
  },
  {
    id: 'bench_1',
    name: 'Скамейка 1',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'bench', name: 'Скамья р-р' },
      { id: 'storage', name: 'Рундук р-р' },
    ],
  },
  {
    id: 'bench_2',
    name: 'Скамейка 2',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'bench', name: 'Скамья р-р' },
      { id: 'storage', name: 'Рундук р-р' },
    ],
  },
  {
    id: 'table',
    name: 'Стол',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'small', name: 'Маленький' },
      { id: 'big', name: 'Большой' },
      { id: 'none', name: 'Без стола' },
    ],
  },
  {
    id: 'additional_elements',
    name: 'Дополнительные элементы',
    inputType: 'textarea',
    layout: 'column',
    options: [
      { id: 'additional', name: 'Доп:', placeholder: 'дополнительные элементы...' },
    ],
  },
  {
    id: 'steam_room_lighting',
    name: 'Освещение парной',
    inputType: 'checkbox',
    layout: 'row',
    options: [
      { id: 'led', name: 'LED' },
      { id: 'standard', name: 'STANDARD' },
      { id: 'led_rgb', name: 'LED RGB (под полками)' },
    ],
  },
  {
    id: 'guest_room_lighting',
    name: 'Освещение гостевой',
    inputType: 'checkbox',
    layout: 'row',
    options: [
      { id: 'led_plank', name: 'LED + планка' },
      { id: 'standard', name: 'STANDARD' },
      { id: 'premium_led', name: 'Premium LED' },
    ],
  },
  {
    id: 'exterior_lighting',
    name: 'Наружное освещение',
    inputType: 'checkbox',
    layout: 'row',
    options: [
      { id: 'none', name: 'Нет' },
      { id: 'led_neon', name: 'LED NEON' },
      { id: 'retro', name: 'Ретро лампа' },
      { id: 'standard', name: 'Стандартная лампа' },
    ],
  },
  {
    id: 'entrance_door',
    name: 'Входная дверь',
    inputType: 'checkbox',
    layout: 'column',
    options: [
      { id: 'wood_premium', name: 'Деревянная дверь с замком Премиум' },
      { id: 'wood_700x1900', name: 'Деревянная 700х1900' },
      { id: 'glass_700x1900', name: 'Стеклянная 700х1900' },
    ],
  },
  {
    id: 'steam_door',
    name: 'Дверь в парилку',
    inputType: 'checkbox',
    layout: 'column',
    options: [
      { id: 'glass_700x1900', name: 'Стеклянная 700х1900' },
    ],
  },
  {
    id: 'ventilation',
    name: 'Форточки',
    inputType: 'text',
    layout: 'row',
    options: [
      { id: 'size', name: 'Размер', placeholder: 'размер' },
      { id: 'quantity', name: 'Кол-во', placeholder: 'количество' },
    ],
  },
  {
    id: 'panorama',
    name: 'Панорама',
    inputType: 'mixed',
    layout: 'column',
    options: [
      { id: 'none', name: 'Без панорамы', inputType: 'radio' },
      { id: 'half_80x160', name: 'Полупанорама 80x160 cm', inputType: 'text', placeholder: 'кол-во' },
      { id: 'full_160x160', name: 'Панорама 160x160 cm', inputType: 'text', placeholder: 'кол-во' },
    ],
  },
  {
    id: 'heater',
    name: 'Piece (Печь)',
    inputType: 'radio',
    layout: 'column',
    options: [
      { id: 'electric_9kw', name: 'Piec Elektryczne 9 kW' },
      { id: 'wood_internal_12kw', name: 'Piec na Drewno / załadunek wewnętrzna / 12kW' },
      { id: 'wood_external_12kw', name: 'Piec na Drewno / z załadunkiem zewnętrznym / 12kW' },
      { id: 'wood_internal_18kw', name: 'Piec na Drewno / załadunek wewnętrzna / 18kW' },
      { id: 'wood_external_18kw', name: 'Piec na Drewno / z załadunkiem zewnętrznym / 18kW' },
    ],
  },
  {
    id: 'water_tank',
    name: 'Zbiornik na wodę na piec',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'none', name: 'Нет' },
      { id: '30l', name: '30L' },
      { id: '50l', name: '50L' },
    ],
  },
  {
    id: 'shower',
    name: 'Душ',
    inputType: 'radio',
    layout: 'column',
    options: [
      { id: 'none', name: 'Без душа и бойлера' },
      { id: '30l', name: 'Grzejnik elektryczny na wodę 30L + Brodzik + Prysznic' },
      { id: '50l', name: 'Grzejnik elektryczny na wodę 50L + Brodzik + Prysznic' },
    ],
  },
  {
    id: 'additional_options',
    name: 'Opcje Dodatkowe',
    inputType: 'checkbox',
    layout: 'column',
    options: [
      { id: 'none', name: 'Без дополнительных опций' },
      { id: 'lounger', name: 'Ergonomiczny profilowany leżak' },
      { id: 'stairs', name: 'Schody przed wejściem' },
      { id: 'roof_entrance', name: 'Dach nad wejściem przy opcji wejścia frontowego' },
      { id: 'extra_terrace', name: 'Extra Taras Zewnętrzny (50cm 2 Lawki)' },
    ],
  },
  {
    id: 'frame_beams',
    name: 'Belki podłużne do podstawy ramy sauny',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'yes', name: 'Да' },
      { id: 'no', name: 'Нет' },
    ],
  },
];
