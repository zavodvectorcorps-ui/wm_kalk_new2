// Planner shared constants & helpers

export const STATUSES = [
  { key: 'idea',        label: 'Идея',          color: 'bg-slate-100 text-slate-700 border-slate-300',  bgSoft: 'bg-slate-50' },
  { key: 'planned',     label: 'Запланировано', color: 'bg-blue-100 text-blue-700 border-blue-300',     bgSoft: 'bg-blue-50/50' },
  { key: 'in_progress', label: 'В работе',      color: 'bg-amber-100 text-amber-800 border-amber-300',  bgSoft: 'bg-amber-50/50' },
  { key: 'review',      label: 'На проверке',   color: 'bg-purple-100 text-purple-700 border-purple-300', bgSoft: 'bg-purple-50/50' },
  { key: 'done',        label: 'Готово',        color: 'bg-emerald-100 text-emerald-700 border-emerald-300', bgSoft: 'bg-emerald-50/50' },
  { key: 'cancelled',   label: 'Отменено',      color: 'bg-red-100 text-red-700 border-red-300',         bgSoft: 'bg-red-50/50' },
];

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

export const PRIORITIES = [
  { key: 'low',    label: 'Низкий',  color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  { key: 'medium', label: 'Средний', color: 'bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-500' },
  { key: 'high',   label: 'Высокий', color: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500' },
  { key: 'urgent', label: 'Срочно',  color: 'bg-red-100 text-red-700 border-red-300',         dot: 'bg-red-600' },
];

export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.key, p]));

export const isOverdue = (task) => {
  if (!task?.dueDate) return false;
  if (['done', 'cancelled'].includes(task.status)) return false;
  return task.dueDate < new Date().toISOString().slice(0, 10);
};

export const formatDate = (iso) => {
  if (!iso) return '';
  try {
    if (iso.length === 10) {
      const [y, m, d] = iso.split('-');
      return `${d}.${m}.${y.slice(2)}`;
    }
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return iso; }
};

export const formatDateTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const dirById = (directions, id) =>
  (directions || []).find((d) => d.id === id) || { id: id || 'other', name: 'Другое', color: '#94a3b8' };
