/**
 * Layout Configurator Constants
 */

// A4 Landscape dimensions for canvas
export const A4_LANDSCAPE = {
  widthPx: 1200,
  heightPx: 800,
  widthCm: 29.7,
  heightCm: 21.0,
};

// Default scale: how many real cm fit in the canvas
export const DEFAULT_CANVAS_REAL_SIZE = {
  widthCm: 900,  // Real width the canvas represents (9m)
  heightCm: 600, // Real height the canvas represents (6m)
};

// Drawing tools configuration
export const DRAWING_TOOLS = {
  select: { icon: 'MousePointer', name: 'Выбор', cursor: 'default', shortcut: 'V' },
  rectangle: { icon: 'Square', name: 'Прямоугольник', cursor: 'crosshair', shortcut: 'R' },
  wall: { icon: 'Minus', name: 'Стена/Линия', cursor: 'crosshair', shortcut: 'L' },
  ruler: { icon: 'Ruler', name: 'Линейка', cursor: 'crosshair', shortcut: 'M' },
  text: { icon: 'Type', name: 'Текст', cursor: 'text', shortcut: 'T' },
};

// Element type icons and colors
export const ELEMENT_TYPES = {
  heater: { icon: '🔥', color: '#ef4444', name: 'Печь', namePl: 'Piec' },
  bench: { icon: '🪑', color: '#8b5cf6', name: 'Лавка', namePl: 'Ławka' },
  door: { icon: '🚪', color: '#3b82f6', name: 'Дверь', namePl: 'Drzwi' },
  window: { icon: '🪟', color: '#06b6d4', name: 'Окно', namePl: 'Okno' },
  shower: { icon: '🚿', color: '#10b981', name: 'Душ', namePl: 'Prysznic' },
  divider: { icon: '📏', color: '#f59e0b', name: 'Перегородка', namePl: 'Ścianka' },
  stairs: { icon: '🪜', color: '#6366f1', name: 'Ступеньки', namePl: 'Schody' },
  terrace: { icon: '🏡', color: '#84cc16', name: 'Терраса', namePl: 'Taras' },
  other: { icon: '📦', color: '#64748b', name: 'Другое', namePl: 'Inne' },
  rect: { icon: '⬜', color: '#374151', name: 'Область', namePl: 'Obszar' },
  wall: { icon: '➖', color: '#1f2937', name: 'Стена', namePl: 'Ściana' },
};

// Default room form values
export const DEFAULT_ROOM_FORM = {
  outerWidthCm: 200,
  outerHeightCm: 150,
  wallLeftCm: 4.4,
  wallRightCm: 4.4,
  wallTopCm: 4.4,
  wallBottomCm: 4.4,
  isPartition: false,
  partitionPosition: 'vertical',
  partitionOffset: 50,
};

// Default upload form values
export const DEFAULT_UPLOAD_FORM = {
  name: '',
  type: 'other',
  modelId: null,
  file: null,
  widthCm: '',
  heightCm: '',
  fixedHeight: false,
};

// Canvas history settings
export const MAX_HISTORY = 30;

// Serialization properties for canvas objects
export const CANVAS_SERIALIZE_PROPS = [
  'elementId', 'elementType', 'isDrawnShape', 'strokeWidthCm',
  'isMeasurement', 'isMeasurementPart', 'parentId', 'isRuler',
  'showDimensions', 'showDistanceLeft', 'showDistanceRight', 'showDistanceTop', 'showDistanceBottom',
  'assetId', 'assetName', 'isGroup', 'isModelOutline', 'isOutline',
  'widthCm', 'heightCm', 'flipX', 'flipY',
  'isRoom', 'isRoomGroup', 'isOuterWall', 'isInnerRoom', 'isPartition', 'partitionType', 'offsetCm',
  'outerWidthCm', 'outerHeightCm', 'innerWidthCm', 'innerHeightCm',
  'wallLeftCm', 'wallRightCm', 'wallTopCm', 'wallBottomCm', 'wallThicknessCm',
  'lockScalingY', 'fixedHeightCm',
  'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle'
];

export const API_URL = process.env.REACT_APP_BACKEND_URL || '';
