import React from 'react';
import { ClipboardList, User, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { STATUS_MAP } from './constants';

export default function PlannerDashboard({ stats, directions }) {
  if (!stats) return null;

  const tiles = [
    { label: 'Всего активных', value: stats.totalActive,  icon: ClipboardList,  color: 'text-slate-600',  bg: 'bg-slate-100' },
    { label: 'Мои активные',   value: stats.myActive,     icon: User,           color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Просрочено',     value: stats.overdue,      icon: AlertTriangle,  color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Срочные',        value: stats.urgent,       icon: Zap,            color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Готово за 7 дн.',value: stats.completed7d,  icon: CheckCircle2,   color: 'text-emerald-600',bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="planner-dashboard-tiles">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="border rounded-lg bg-card p-4 flex items-center gap-3" data-testid={`tile-${t.label}`}>
              <div className={`shrink-0 w-10 h-10 rounded-md flex items-center justify-center ${t.bg}`}>
                <Icon className={`w-5 h-5 ${t.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold leading-none">{t.value || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <BreakdownCard
          title="По статусам"
          items={Object.entries(stats.byStatus || {}).map(([k, v]) => ({
            label: STATUS_MAP[k]?.label || k,
            value: v,
            color: STATUS_MAP[k]?.color || '',
          }))}
        />
        <BreakdownCard
          title="По направлениям"
          items={Object.entries(stats.byDirection || {}).map(([k, v]) => {
            const d = (directions || []).find((x) => x.id === k);
            return { label: d?.name || k, value: v, dotColor: d?.color || '#94a3b8' };
          })}
        />
        <BreakdownCard
          title="Топ исполнителей"
          items={(stats.byAssignee || []).map((a) => ({
            label: a.username || '—',
            value: a.count,
          }))}
        />
      </div>
    </div>
  );
}

function BreakdownCard({ title, items }) {
  const total = items.reduce((acc, i) => acc + (i.value || 0), 0) || 1;
  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="text-sm font-semibold mb-3 text-slate-700">{title}</div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground">Нет данных</div>
        ) : items.map((it, i) => {
          const pct = Math.round((it.value || 0) * 100 / total);
          return (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {it.dotColor && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: it.dotColor }} />}
                  {it.color ? <span className={`px-1.5 py-0.5 rounded border text-[10px] ${it.color}`}>{it.label}</span> : <span>{it.label}</span>}
                </div>
                <span className="font-medium">{it.value}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                <div className="h-full bg-slate-400 rounded" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
