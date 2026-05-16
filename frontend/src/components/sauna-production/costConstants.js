// Sauna Tech Cards / Components — shared constants + helpers
import { getApiUrl } from '../../utils/api';

export const API = getApiUrl();
export const COST_BASE = `${API}/api/sauna-production/cost`;

export const authHeaders = () => {
  const t = localStorage.getItem('authToken');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export const COMPONENT_CATEGORIES = [
  { id: 'wood',      name: 'Дерево',     color: '#a16207' },
  { id: 'metal',     name: 'Металл',     color: '#64748b' },
  { id: 'fasteners', name: 'Крепёж',     color: '#475569' },
  { id: 'electric',  name: 'Электрика',  color: '#eab308' },
  { id: 'heater',    name: 'Печь',       color: '#dc2626' },
  { id: 'glass',     name: 'Стекло',     color: '#0ea5e9' },
  { id: 'insulation',name: 'Изоляция',   color: '#f97316' },
  { id: 'finishing', name: 'Отделка',    color: '#10b981' },
  { id: 'other',     name: 'Прочее',     color: '#94a3b8' },
];
export const CAT_BY_ID = Object.fromEntries(COMPONENT_CATEGORIES.map((c) => [c.id, c]));

export const UNITS = ['шт', 'м', 'м²', 'м³', 'кг', 'л', 'компл'];

export const fmtMoney = (n) => {
  if (n === null || n === undefined || n === '') return '—';
  const v = Math.round(Number(n));
  return v.toLocaleString('ru-RU') + ' zł';
};

export const fmtNumber = (n, d = 2) => {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d });
};
