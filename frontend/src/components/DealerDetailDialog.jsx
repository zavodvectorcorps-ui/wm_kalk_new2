import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Loader2, Mail, Phone, Hash, Building2, Calendar, CreditCard, Coins, FileText,
  TrendingUp, ShoppingCart, Wallet, BarChart3, X,
} from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API = getApiUrl();
const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('pl-PL', { maximumFractionDigits: 0 }).replace(/,/g, ' ');

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const STATUS_LABEL = {
  draft: { txt: 'Черновик', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmed: { txt: 'Подтверждён', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  archived: { txt: 'Архив', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/**
 * DealerDetailDialog — full-screen detail view for a single dealer.
 *
 * Props:
 *  - dealerId: string  (id of the dealer to load)
 *  - onClose: () => void
 *  - onEdit?: (dealer) => void  — caller may open the edit form from here
 */
export default function DealerDetailDialog({ dealerId, onClose, onEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealerId) return;
    let cancelled = false;
    setLoading(true);
    axios.get(`${API}/api/admin/dealers/${dealerId}/detail`, { headers: authHeaders() })
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => toast.error(e?.response?.data?.detail || 'Ошибка загрузки'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dealerId]);

  const dealer = data?.dealer;
  const kpis = data?.kpis || {};
  const overrides = data?.overrides || {};
  const orders = data?.recentOrders || [];

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-6xl max-h-[92vh] overflow-y-auto p-0"
        data-testid="dealer-detail-dialog"
      >
        {loading ? (
          <div className="p-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загрузка…
          </div>
        ) : !dealer ? (
          <div className="p-16 text-center text-muted-foreground">Дилер не найден</div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-3 border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Building2 className="h-5 w-5 text-orange-500" />
                    {dealer.name || dealer.username}
                  </DialogTitle>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    @{dealer.username}
                    {dealer.orderPrefix && (
                      <span className="ml-3 text-orange-600">Префикс: {dealer.orderPrefix}-</span>
                    )}
                    <span className="ml-3">{dealer.isActive
                      ? <span className="text-emerald-600">● Активен</span>
                      : <span className="text-red-500">● Отключён</span>}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <Button size="sm" variant="outline" onClick={() => onEdit(dealer)} data-testid="dd-edit-btn">
                      Редактировать
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={onClose} data-testid="dd-close-btn">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {/* KPI strip */}
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b bg-muted/20">
              <KpiCard icon={<ShoppingCart className="h-4 w-4" />} label="Заказов (подтв.)"
                       value={`${kpis.confirmedCount || 0} / ${kpis.ordersTotal || 0}`}
                       sub={`черновиков: ${kpis.draftCount || 0}`} testId="kpi-orders" />
              <KpiCard icon={<Wallet className="h-4 w-4" />} label="Оборот WM"
                       value={`${fmtMoney(kpis.revenue)} PLN`}
                       sub={`средний чек ${fmtMoney(kpis.avgCheck)} PLN`} testId="kpi-revenue" />
              <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Маржа WM"
                       value={`${fmtMoney(kpis.margin)} PLN`}
                       sub={`${(kpis.marginPct || 0).toFixed(1)}% от себест.`}
                       tone={kpis.margin >= 0 ? 'pos' : 'neg'} testId="kpi-margin" />
              <KpiCard icon={<BarChart3 className="h-4 w-4" />} label="Ценовые оверрайды"
                       value={overrides.total || 0}
                       sub={`B2B: ${overrides.b2b || 0} · розница: ${overrides.retail || 0}`}
                       testId="kpi-overrides" />
            </div>

            <Tabs defaultValue="info" className="px-6 pt-4 pb-6">
              <TabsList>
                <TabsTrigger value="info" data-testid="dd-tab-info">Информация</TabsTrigger>
                <TabsTrigger value="orders" data-testid="dd-tab-orders">
                  Заказы <span className="ml-1 text-[10px] opacity-60">({orders.length})</span>
                </TabsTrigger>
                <TabsTrigger value="prices" data-testid="dd-tab-prices">
                  Цены <span className="ml-1 text-[10px] opacity-60">({overrides.total || 0})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Section title="Контакты">
                    <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={dealer.email} />
                    <Row icon={<Phone className="h-3.5 w-3.5" />} label="Телефон" value={dealer.phone} />
                  </Section>
                  <Section title="Параметры">
                    <Row icon={<Hash className="h-3.5 w-3.5" />} label="Префикс заказов"
                         value={dealer.orderPrefix ? `${dealer.orderPrefix}-` : '— (WMS-D)'} />
                    <Row icon={<CreditCard className="h-3.5 w-3.5" />} label="Валюта"
                         value={`${dealer.currency || 'PLN'}${dealer.eurRate ? ` · курс ${dealer.eurRate}` : ''}`} />
                    {dealer.defaultMarkupPercent != null && (
                      <Row icon={<Coins className="h-3.5 w-3.5" />} label="Авто-наценка"
                           value={`+${dealer.defaultMarkupPercent}% · ${dealer.defaultMarkupScope || 'all'} (${dealer.defaultMarkupBase || 'wm'})${dealer.onboardedAt ? ' ✓ применена' : ' ⏳ ждёт первого входа'}`} />
                    )}
                  </Section>
                  <Section title="Временные метки">
                    <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Создан" value={fmtDate(dealer.createdAt)} />
                    <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Обновлён" value={fmtDate(dealer.updatedAt)} />
                    {dealer.onboardedAt && (
                      <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Первый вход" value={fmtDate(dealer.onboardedAt)} />
                    )}
                  </Section>
                  {dealer.notes && (
                    <Section title="Заметки">
                      <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{dealer.notes}</pre>
                    </Section>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="orders" className="mt-4">
                {orders.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">
                    У дилера ещё нет заказов
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2">ID / Договор</th>
                          <th className="text-left px-3 py-2">Дата</th>
                          <th className="text-left px-3 py-2">Клиент</th>
                          <th className="text-left px-3 py-2">Модель</th>
                          <th className="text-left px-3 py-2">Статус</th>
                          <th className="text-right px-3 py-2">Розница</th>
                          <th className="text-right px-3 py-2">WM B2B</th>
                          <th className="text-right px-3 py-2">Маржа</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => {
                          const st = STATUS_LABEL[o.status] || STATUS_LABEL.draft;
                          return (
                            <tr key={o.id} className="border-t hover:bg-muted/20" data-testid={`dd-order-${o.id}`}>
                              <td className="px-3 py-2">
                                <div className="font-mono text-xs">{o.id}</div>
                                {o.contractNumber && (
                                  <div className="text-[10px] text-muted-foreground">№ {o.contractNumber}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {fmtDate(o.confirmedAt || o.createdAt)}
                              </td>
                              <td className="px-3 py-2 text-xs">{o.clientName || '—'}</td>
                              <td className="px-3 py-2 text-xs">{o.modelName || '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${st.cls}`}>
                                  {st.txt}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono">{fmtMoney(o.total)} zł</td>
                              <td className="px-3 py-2 text-right font-mono text-cyan-700">
                                {o.manufacturerTotal > 0 ? `${fmtMoney(o.manufacturerTotal)} zł` : '—'}
                              </td>
                              <td className={`px-3 py-2 text-right font-mono ${o.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {o.manufacturerTotal > 0 ? `${fmtMoney(o.margin)} zł` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="prices" className="mt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <KpiCard icon={<FileText className="h-4 w-4" />} label="B2B-цены установлены"
                           value={overrides.b2b || 0}
                           sub="Себестоимость для дилера" testId="dd-prices-b2b" />
                  <KpiCard icon={<FileText className="h-4 w-4" />} label="Рекоменд. розница установлена"
                           value={overrides.retail || 0}
                           sub="Цены, которые видит клиент" testId="dd-prices-retail" />
                  <KpiCard icon={<FileText className="h-4 w-4" />} label="Всего записей"
                           value={overrides.total || 0}
                           sub="по этому дилеру" testId="dd-prices-total" />
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50/30 p-3 text-sm">
                  Подробное редактирование — на вкладке <b>«Цены»</b> в админке (кнопка «Цены» в строке дилера)
                  или в <b>«Производство → Матрица дилера»</b>.
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="font-medium">{value || '—'}</div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, tone = 'neutral', testId }) {
  const toneCls = tone === 'pos'
    ? 'border-emerald-200 bg-emerald-50/40'
    : tone === 'neg'
      ? 'border-red-200 bg-red-50/40'
      : 'border-slate-200 bg-card';
  return (
    <div className={`rounded-lg border ${toneCls} p-3`} data-testid={testId}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className="font-mono font-bold text-lg mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
