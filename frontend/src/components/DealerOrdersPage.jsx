import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Building2, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

const API = getApiUrl();
const fmtPLN = (n) => `${Math.round(Number(n) || 0).toLocaleString('pl-PL').replace(/,/g, ' ')} PLN`;
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_e) { return String(d); }
};

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function DealerOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dealerFilter, setDealerFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/admin/dealer-orders`, { headers: authHeaders() });
      setOrders(r.data.orders || []);
    } catch (_e) {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const dealers = useMemo(() => {
    const set = new Map();
    orders.forEach(o => { if (o.dealerId) set.set(o.dealerId, o.dealerName || o.dealerUsername || o.dealerId); });
    return Array.from(set.entries());
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (dealerFilter !== 'all' && o.dealerId !== dealerFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [o.id, o.customerName, o.customerPhone, o.modelName, o.dealerName].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, dealerFilter]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, o) => {
      acc.count += 1;
      acc.value += Number(o.total) || 0;
      acc.cost += Number(o.totalCost) || 0;
      return acc;
    }, { count: 0, value: 0, cost: 0 });
  }, [filtered]);

  return (
    <div className="space-y-6" data-testid="dealer-orders-admin">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-orange-500" />
            Заказы дилеров
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Все заказы, созданные через дилерский портал. Маржа считается с учётом ваших цен (а не дилерских).
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} data-testid="refresh-dealer-orders">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />} Обновить
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiTile label="Заказов" value={totals.count} />
        <KpiTile label="Сумма" value={fmtPLN(totals.value)} />
        <KpiTile label="Маржа" value={fmtPLN(Math.max(0, totals.value - totals.cost))} accent="emerald" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Поиск по номеру, клиенту, дилеру…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="dealer-orders-search"
        />
        <select
          value={dealerFilter}
          onChange={(e) => setDealerFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          data-testid="dealer-orders-filter"
        >
          <option value="all">Все дилеры ({dealers.length})</option>
          {dealers.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-muted-foreground" data-testid="dealer-orders-empty">
          <Building2 className="h-10 w-10 mx-auto mb-4 opacity-40" />
          <div>Заказов от дилеров пока нет.</div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Номер</th>
                <th className="text-left px-4 py-3">Дилер</th>
                <th className="text-left px-4 py-3">Клиент</th>
                <th className="text-left px-4 py-3">Модель</th>
                <th className="text-right px-4 py-3">Сумма</th>
                <th className="text-right px-4 py-3 text-amber-700 dark:text-amber-400">Маржа</th>
                <th className="text-left px-4 py-3">amoCRM</th>
                <th className="text-left px-4 py-3">Создан</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const margin = Math.max(0, (Number(o.total) || 0) - (Number(o.totalCost) || 0));
                const marginPct = o.total > 0 && o.totalCost ? Math.round((margin / o.total) * 100) : null;
                return (
                  <tr key={o.id} className="border-t hover:bg-muted/20" data-testid={`dealer-order-${o.id}`}>
                    <td className="px-4 py-3 font-mono text-xs">{o.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.dealerName || o.dealerUsername || '—'}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">@{o.dealerUsername}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{o.customerName || '—'}</div>
                      <div className="text-[11px] text-muted-foreground">{o.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{o.modelName || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold">{fmtPLN(o.total)}</td>
                    <td className="px-4 py-3 text-right">
                      {o.totalCost ? (
                        <div className="text-emerald-600 dark:text-emerald-400">
                          <div className="font-semibold">{fmtPLN(margin)}</div>
                          {marginPct != null && <div className="text-[11px] text-muted-foreground">{marginPct}%</div>}
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {o.amocrm_lead_id ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <ExternalLink className="h-3 w-3" /> #{o.amocrm_lead_id}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(o.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiTile({ label, value, accent }) {
  const color = accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : '';
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
