// Technical specification categories for sauna production
// Structured by production sections: General → Парная → Комната отдыха → Электрика

export const TECH_SPEC_CATEGORIES = [
  // === ОБЩЕЕ ===
  {
    id: 'model_size',
    name: 'Модель / Размер',
    section: 'general',
    inputType: 'text',
    layout: 'column',
    options: [
      { id: 'total_size', name: 'Общий размер', placeholder: 'напр. 400x240 см' },
      { id: 'rest_room_size', name: 'Комната отдыха', placeholder: 'напр. 200x240 см' },
      { id: 'steam_room_size', name: 'Парная', placeholder: 'напр. 200x240 см' },
    ],
  },
  {
    id: 'execution',
    name: 'Исполнение',
    section: 'general',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'standard', name: 'Стандарт' },
      { id: 'thermopol', name: 'Термопол' },
      { id: 'full_thermo', name: 'Вся из термо' },
    ],
  },
  {
    id: 'sauna_color',
    name: 'Цвет сауны',
    section: 'general',
    inputType: 'text',
    layout: 'row',
    calcCategoryMapping: 'kolor',
    options: [
      { id: 'color_value', name: 'Цвет', placeholder: 'переносится из калькулятора' },
    ],
  },
  {
    id: 'roof_color',
    name: 'Цвет крыши',
    section: 'general',
    inputType: 'text',
    layout: 'row',
    calcCategoryMapping: 'kolor_dachu',
    options: [
      { id: 'color_value', name: 'Цвет крыши', placeholder: 'переносится из калькулятора' },
    ],
  },

  // === ПАРНАЯ ===
  {
    id: 'steam_room_dimensions',
    name: 'Размер парной',
    section: 'steam_room',
    sectionTitle: 'Парная',
    inputType: 'text',
    layout: 'row',
    options: [
      { id: 'dimensions', name: 'Размер', placeholder: 'напр. 200x200 см' },
    ],
  },
  {
    id: 'benches',
    name: 'Лавки',
    section: 'steam_room',
    inputType: 'calc_transfer',
    layout: 'column',
    calcCategoryMapping: 'lawki',
    options: [],
  },
  {
    id: 'backrests',
    name: 'Подспинники',
    section: 'steam_room',
    inputType: 'radio',
    layout: 'row',
    calcCategoryMapping: 'podspinniki',
    options: [
      { id: 'yes', name: 'Да' },
      { id: 'no', name: 'Нет' },
    ],
  },
  {
    id: 'stove_guard',
    name: 'Ограждение печки',
    section: 'steam_room',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'yes', name: 'Да' },
      { id: 'no', name: 'Нет' },
    ],
  },
  {
    id: 'stove_type',
    name: 'Печь',
    section: 'steam_room',
    inputType: 'radio',
    layout: 'column',
    options: [
      { id: 'electric', name: 'Электро' },
      { id: 'wood', name: 'Дровяная' },
    ],
    conditionalFields: {
      electric: [
        { id: 'power', name: 'Мощность', inputType: 'text', placeholder: 'напр. 9 кВт' },
      ],
      wood: [
        { id: 'loading', name: 'Загрузка', inputType: 'radio', options: [
          { id: 'internal', name: 'Внутренняя' },
          { id: 'external', name: 'С выносом' },
        ]},
      ],
    },
  },
  {
    id: 'chimney',
    name: 'Дымоход',
    section: 'steam_room',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'with_tank', name: 'С баком' },
      { id: 'without_tank', name: 'Без бака' },
    ],
  },
  {
    id: 'steam_vents',
    name: 'Форточка в парной',
    section: 'steam_room',
    inputType: 'text',
    layout: 'row',
    options: [
      { id: 'quantity', name: 'Кол-во', placeholder: 'шт.' },
      { id: 'size', name: 'Размер', placeholder: 'напр. 40x40 см' },
    ],
  },
  {
    id: 'air_valves',
    name: 'Воздушные клапаны',
    section: 'steam_room',
    inputType: 'radio',
    layout: 'row',
    defaultValue: 'yes',
    options: [
      { id: 'yes', name: 'Да' },
      { id: 'no', name: 'Нет' },
    ],
  },
  {
    id: 'steam_panorama',
    name: 'Панорама в парной',
    section: 'steam_room',
    inputType: 'checkbox',
    layout: 'column',
    options: [
      { id: 'none', name: 'Без панорамы' },
      { id: 'half_80x160', name: 'Полупанорама 80x160 см' },
      { id: 'full_160x160', name: 'Панорама 160x160 см' },
      { id: 'custom', name: 'Другой размер', hasCustomField: true },
    ],
  },

  // === КОМНАТА ОТДЫХА ===
  {
    id: 'rest_room_dimensions',
    name: 'Размер комнаты отдыха',
    section: 'rest_room',
    sectionTitle: 'Комната отдыха',
    inputType: 'text',
    layout: 'row',
    options: [
      { id: 'dimensions', name: 'Размер', placeholder: 'напр. 200x240 см' },
    ],
  },
  {
    id: 'door_type',
    name: 'Дверь',
    section: 'rest_room',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'wood', name: 'Деревянная' },
      { id: 'glass', name: 'Стеклянная' },
    ],
  },
  {
    id: 'bench_1',
    name: 'Скамья 1',
    section: 'rest_room',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'runduk', name: 'Рундук' },
      { id: 'bench', name: 'Скамья' },
    ],
  },
  {
    id: 'bench_2',
    name: 'Скамья 2',
    section: 'rest_room',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'runduk', name: 'Рундук' },
      { id: 'bench', name: 'Скамья' },
    ],
  },
  {
    id: 'shower_tray',
    name: 'Душевой поддон',
    section: 'rest_room',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'yes', name: 'Да' },
      { id: 'no', name: 'Нет' },
    ],
  },
  {
    id: 'boiler_shower',
    name: 'Бойлер и лейка',
    section: 'rest_room',
    inputType: 'radio',
    layout: 'row',
    options: [
      { id: 'yes', name: 'Да' },
      { id: 'no', name: 'Нет' },
    ],
  },
  {
    id: 'rest_panorama',
    name: 'Панорама в комнате отдыха',
    section: 'rest_room',
    inputType: 'checkbox',
    layout: 'column',
    options: [
      { id: 'none', name: 'Без панорамы' },
      { id: 'half_80x160', name: 'Полупанорама 80x160 см' },
      { id: 'full_160x160', name: 'Панорама 160x160 см' },
      { id: 'custom', name: 'Другой размер', hasCustomField: true },
    ],
  },
  {
    id: 'rest_vents',
    name: 'Форточки в комнате отдыха',
    section: 'rest_room',
    inputType: 'text',
    layout: 'row',
    options: [
      { id: 'quantity', name: 'Кол-во', placeholder: 'шт.' },
      { id: 'size', name: 'Размер', placeholder: 'напр. 40x40 см' },
    ],
  },

  // === ЭЛЕКТРИКА ===
  {
    id: 'electric_steam',
    name: 'Парная',
    section: 'electric',
    sectionTitle: 'Электрика',
    inputType: 'checkbox',
    layout: 'row',
    options: [
      { id: 'led', name: 'LED' },
      { id: 'standard', name: 'Стандарт' },
    ],
  },
  {
    id: 'electric_rest',
    name: 'Комната отдыха',
    section: 'electric',
    inputType: 'checkbox',
    layout: 'row',
    options: [
      { id: 'led', name: 'LED' },
      { id: 'standard', name: 'Стандарт' },
      { id: 'socket', name: 'Розетка' },
    ],
  },
  {
    id: 'electric_exterior',
    name: 'Внешний',
    section: 'electric',
    inputType: 'checkbox',
    layout: 'row',
    options: [
      { id: 'led', name: 'LED' },
      { id: 'standard', name: 'Стандарт' },
      { id: 'led_panorama', name: 'LED панорама' },
    ],
  },
];

export const TECH_SPEC_SECTIONS = [
  { id: 'general', name: 'Общее', icon: 'info' },
  { id: 'steam_room', name: 'Парная', icon: 'flame' },
  { id: 'rest_room', name: 'Комната отдыха', icon: 'sofa' },
  { id: 'electric', name: 'Электрика', icon: 'zap' },
];
