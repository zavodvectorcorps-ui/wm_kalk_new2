import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Calculator as CalcIcon, Package, BarChart3, Settings, LogOut,
  TrendingUp, DollarSign, ShoppingCart, Building2, Loader2, Save, RefreshCw, AlertCircle, FileText, Link2, Eye, Pencil, Bookmark, Plus, X, Cloud, CloudOff
} from 'lucide-react';
import { getApiUrl } from '../../utils/api';
import { dealerAuthHeaders, clearDealerSession, getDealerInfo, fetchDealerMe } from '../../utils/dealerAuth';
import DealerCalculatorWrapper from './DealerCalculatorWrapper';
import { setSyncStatus, clearSyncStatus } from '../../utils/syncStatus';
import GlobalSyncPill from '../GlobalSyncPill';

const API = getApiUrl();

// ==================== Shared helpers ====================
const fmtPLN = (n) => `${Math.round(Number(n) || 0).toLocaleString('pl-PL').replace(/,/g, ' ')} PLN`;
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch (_e) { return String(d); }
};

// ==================== Stats Tab ====================
function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/dealer/stats`, { headers: dealerAuthHeaders() })
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!stats) return <div className="text-slate-400 py-10">Brak danych.</div>;

  const maxWeek = Math.max(...(stats.weekly || []).map(w => w.count), 1);

  return (
    <div className="space-y-6" data-testid="dealer-stats">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={ShoppingCart} label="Wszystkie zamówienia" value={stats.totalOrders} color="#06b6d4" testid="stats-total-orders" />
        <KpiCard icon={DollarSign} label="Łączna kwota" value={fmtPLN(stats.totalValue)} color="#10b981" testid="stats-total-value" />
        <KpiCard icon={TrendingUp} label="Średnia wartość" value={fmtPLN(stats.avgOrderValue)} color="#f59e0b" testid="stats-avg-order" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Zamówienia tygodniowo</h3>
          <span className="text-xs text-slate-500">ostatnie 12 tygodni</span>
        </div>
        <div className="flex items-end gap-2 h-40">
          {(stats.weekly || []).map((w) => {
            const h = (w.count / maxWeek) * 100;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1" title={`${w.week}: ${w.count} zamówień · ${fmtPLN(w.value)}`}>
                <div className="text-[10px] text-slate-500">{w.count || ''}</div>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(h, 2)}%`,
                    background: w.count > 0 ? 'linear-gradient(to top, #f97316, #fbbf24)' : 'rgba(255,255,255,0.05)',
                  }}
                />
                <div className="text-[9px] text-slate-600 whitespace-nowrap rotate-45 origin-top-left mt-2">{w.week.split('-W')[1]}w</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden" data-testid={testid}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ background: color }} />
      <Icon className="h-5 w-5 text-slate-300 mb-4 relative z-10" />
      <div className="text-2xl md:text-3xl font-bold text-white relative z-10">{value}</div>
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-2 relative z-10">{label}</div>
    </div>
  );
}

// ==================== Orders Tab ====================
function downloadOrderPdf(orderId, type = 'offer') {
  if (type === 'full') {
    // Use the same public endpoint managers use — load the order, post it
    // to /api/sauna/generate-pdf, get back a multi-page branded PDF.
    return axios
      .get(`${API}/api/dealer/sauna/orders/${orderId}`, { headers: dealerAuthHeaders() })
      .then((orderResp) => {
        const order = orderResp.data || {};
        const pdfPayload = { ...order, orderId: order.id, language: 'pl' };
        return axios.post(`${API}/api/sauna/generate-pdf`, pdfPayload, {
          responseType: 'blob',
        });
      })
      .then((r) => {
        const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `SAUNA_${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      });
  }
  // Short offer PDF — backend dealer endpoint
  return axios
    .get(`${API}/api/dealer/sauna/orders/${orderId}/pdf?type=offer`, {
      headers: dealerAuthHeaders(),
      responseType: 'blob',
    })
    .then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `oferta-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    });
}

function StatusBadge({ status }) {
  const s = (status || 'draft').toLowerCase();
  if (s === 'confirmed') {
    return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Potwierdzone</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">Wersja robocza</span>;
}

function ClientLinkBadge({ order }) {
  if (order?.clientConfirmedByLink) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" title={`Potwierdzone przez klienta ${order.clientWebConfirmedAt ? new Date(order.clientWebConfirmedAt).toLocaleString('pl-PL') : ''}`}>
        ✓ Klient potwierdził
      </span>
    );
  }
  if (order?.clientWebViews) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30" title="Klient otworzył link">
        <Eye className="h-2.5 w-2.5" /> Otwarte ({order.clientWebViews})
      </span>
    );
  }
  return null;
}

function copyOfferLink(orderId) {
  const link = `${window.location.origin}/oferta/${orderId}`;
  return navigator.clipboard.writeText(link).then(() => link);
}

function OrdersTab({ onEditDraft, reloadKey = 0 }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | draft | confirmed

  const reload = () => {
    setLoading(true);
    axios.get(`${API}/api/dealer/sauna/orders`, { headers: dealerAuthHeaders() })
      .then(r => setOrders(r.data.orders || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, [reloadKey]);

  const handleDownload = async (orderId, type = 'offer') => {
    setDownloadingId(orderId + ':' + type);
    try {
      await downloadOrderPdf(orderId, type);
    } catch (_e) {
      // silent
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm(`Usunąć wersję roboczą ${orderId}?`)) return;
    try {
      await axios.delete(`${API}/api/dealer/sauna/orders/${orderId}`, { headers: dealerAuthHeaders() });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.response?.data?.detail || 'Nie udało się usunąć');
    }
  };

  const filtered = orders.filter((o) => {
    if (filter === 'all') return true;
    const s = (o.status || 'draft').toLowerCase();
    return s === filter;
  });

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Filtr:</span>
        {['all', 'draft', 'confirmed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-${f}`}
            className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider border transition-colors ${
              filter === f
                ? 'bg-orange-500 text-white border-orange-500'
                : 'border-white/10 text-slate-300 hover:bg-white/5'
            }`}
          >
            {f === 'all' ? 'Wszystkie' : f === 'draft' ? 'Wersje robocze' : 'Potwierdzone'}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">razem: {orders.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center" data-testid="dealer-orders-empty">
          <Package className="h-10 w-10 mx-auto text-slate-600 mb-4" />
          <div className="text-lg font-medium text-white mb-2">
            {filter === 'all' ? 'Brak zamówień' : filter === 'draft' ? 'Brak wersji roboczych' : 'Brak potwierdzonych zamówień'}
          </div>
          <div className="text-sm text-slate-400">Utwórz nowy projekt w zakładce „Kalkulator”.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden" data-testid="dealer-orders-table">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Numer / Status</th>
                <th className="text-left px-4 py-3">Klient</th>
                <th className="text-left px-4 py-3">Model</th>
                <th className="text-right px-4 py-3">Klient płaci</th>
                <th className="text-right px-4 py-3" title="Kwota, którą zapłacisz WM">Koszt WM</th>
                <th className="text-right px-4 py-3">Marża</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-right px-4 py-3">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const isDraft = (o.status || 'draft').toLowerCase() === 'draft';
                const retail = Number(o.total) || 0;
                const cost = Number(o.manufacturerTotal);
                const hasCost = Number.isFinite(cost) && cost > 0;
                const margin = hasCost ? retail - cost : null;
                const marginPct = hasCost && cost > 0 ? (margin / cost) * 100 : null;
                return (
                  <tr key={o.id} className="border-t border-white/5 hover:bg-white/[0.02]" data-testid={`dealer-order-${o.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-300">{o.id}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <StatusBadge status={o.status} />
                        <ClientLinkBadge order={o} />
                      </div>
                      {o.dealerContractNumber && (
                        <div className="text-[10px] text-slate-500 mt-0.5">№ {o.dealerContractNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{o.customerName || o.clientName || o.fullName || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{o.modelName || o.model?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{fmtPLN(retail)}</td>
                    <td className="px-4 py-3 text-right text-cyan-300 font-mono text-xs">
                      {hasCost ? fmtPLN(cost) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {margin === null ? (
                        <span className="text-slate-600 text-xs">—</span>
                      ) : (
                        <div className={margin >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                          <div className="font-semibold">{fmtPLN(margin)}</div>
                          {marginPct !== null && <div className="text-[10px]">{marginPct.toFixed(1)}%</div>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => onEditDraft?.(o)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs hover:bg-emerald-500/10"
                            data-testid={`dealer-order-edit-${o.id}`}
                            title="Edytuj wersję roboczą i potwierdź"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edytuj
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const link = await copyOfferLink(o.id);
                              toast.success('Link skopiowany', { description: link });
                            } catch (_e) {
                              toast.error('Nie udało się skopiować linku');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-orange-500/40 text-orange-300 text-xs hover:bg-orange-500/10"
                          data-testid={`dealer-order-share-${o.id}`}
                          title="Skopiuj publiczny link do oferty (do wysłania klientowi)"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Link
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(o.id, 'offer')}
                          disabled={downloadingId === o.id + ':offer'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                          data-testid={`dealer-order-pdf-${o.id}`}
                          title="Oferta (krótka)"
                        >
                          {downloadingId === o.id + ':offer' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          KP
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(o.id, 'full')}
                          disabled={downloadingId === o.id + ':full'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                          data-testid={`dealer-order-pdf-full-${o.id}`}
                          title="Pełny PDF (taki jak u menedżerów)"
                        >
                          {downloadingId === o.id + ':full' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          Pełny
                        </button>
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => handleDelete(o.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10"
                            data-testid={`dealer-order-delete-${o.id}`}
                            title="Usuń wersję roboczą"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
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

export { downloadOrderPdf };

// ==================== Price Editor Tab ====================
// Two-price model:
//   • `b2bPrice`  — what the dealer pays to WM (B2B Brutto). Read-only here.
//                   Owned by admin (Price Simulator → "Apply to dealer").
//   • `dealerRetailPrice` — what the dealer charges his client. Editable here.
//                           Saved as the override `dealerRetailPrice` field.
function PricesTab() {
  const [prices, setPrices] = useState(null);     // /api/dealer/sauna/prices (carries b2bPrice + baseRetailWm per row)
  const [retailMap, setRetailMap] = useState({}); // key -> dealerRetailPrice as string (editing buffer)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Bulk markup controls
  const [markupOpen, setMarkupOpen] = useState(false);
  const [markupPct, setMarkupPct] = useState('15');
  const [markupBase, setMarkupBase] = useState('b2b'); // 'b2b' | 'wm'
  const [markupScope, setMarkupScope] = useState('all'); // 'all' | 'models' | 'options'
  const [markupOverwrite, setMarkupOverwrite] = useState(true);

  // Markup presets
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');

  // Auto-save (debounced 1.5s) so dealers never lose retail edits by forgetting to click Zapisz.
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // idle | pending | saving | saved | error
  const lastSavedRef = useRef('');
  const debounceRef = useRef(null);
  const retailMapRef = useRef(retailMap);
  useEffect(() => { retailMapRef.current = retailMap; }, [retailMap]);
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);
  // Surface this tab's state to the global Sync indicator in the header.
  useEffect(() => { setSyncStatus('dealer-prices', autoSaveStatus); }, [autoSaveStatus]);
  useEffect(() => () => { clearSyncStatus('dealer-prices'); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pricesRes, ovrRes, presetsRes] = await Promise.all([
        axios.get(`${API}/api/dealer/sauna/prices`, { headers: dealerAuthHeaders() }),
        axios.get(`${API}/api/dealer/sauna/overrides`, { headers: dealerAuthHeaders() }),
        axios.get(`${API}/api/dealer/markup-presets`, { headers: dealerAuthHeaders() }),
      ]);
      setPrices(pricesRes.data);
      const map = {};
      (ovrRes.data.overrides || []).forEach((o) => {
        if (o.dealerRetailPrice !== null && o.dealerRetailPrice !== undefined) {
          map[keyOf(o)] = String(o.dealerRetailPrice);
        }
      });
      setRetailMap(map);
      // Seed auto-save baseline so the first real edit triggers a save,
      // not the initial load.
      lastSavedRef.current = _normalizeRetailMap(map);
      setAutoSaveStatus('saved');
      setPresets(presetsRes.data?.presets || []);
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setRetail = (key, val) => setRetailMap((prev) => ({ ...prev, [key]: val }));

  // Build a stable, normalized snapshot of the retail map so "5" and 5 don't
  // count as different and removed entries (empty strings) drop out.
  function _normalizeRetailMap(map) {
    const out = {};
    Object.keys(map || {})
      .sort()
      .forEach((k) => {
        const n = parseInt(map[k], 10);
        if (Number.isFinite(n) && n > 0) out[k] = n;
      });
    return JSON.stringify(out);
  }

  // Internal save: builds the overrides array from current retailMap and
  // pushes to the backend. Used by both manual `handleSave` (loud) and the
  // debounced auto-saver (silent).
  const doSave = useCallback(async ({ silent } = {}) => {
    const map = retailMapRef.current;
    const payload = { overrides: [] };
    for (const [key, val] of Object.entries(map)) {
      const num = parseInt(val, 10);
      if (!Number.isFinite(num) || num < 0) continue;
      payload.overrides.push({ ...unkeyOf(key), dealerRetailPrice: num, dealerId: '' });
    }
    try {
      if (!silent) { setSaving(true); setMsg(''); }
      else setAutoSaveStatus('saving');
      await axios.put(`${API}/api/dealer/sauna/overrides`, payload, { headers: dealerAuthHeaders() });
      if (!isMountedRef.current) return;
      lastSavedRef.current = _normalizeRetailMap(map);
      if (silent) setAutoSaveStatus('saved');
      else {
        setMsg(`Zapisano (${payload.overrides.length} pozycji)`);
        setTimeout(() => { if (isMountedRef.current) setMsg(''); }, 3000);
      }
    } catch (e) {
      if (silent) setAutoSaveStatus('error');
      else setMsg(e?.response?.data?.detail || 'Błąd zapisu');
      throw e;
    } finally {
      if (!silent && isMountedRef.current) setSaving(false);
    }
  }, []);

  const handleSave = async () => {
    // Manual save → flush any pending debounce, then loud save.
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    try { await doSave({ silent: false }); await load(); } catch (_e) { /* msg already set */ }
  };

  // Debounced auto-save: every retailMap change schedules a silent save in 1.5s.
  useEffect(() => {
    if (loading) return;
    const snap = _normalizeRetailMap(retailMap);
    if (snap === lastSavedRef.current) {
      setAutoSaveStatus('saved');
      return;
    }
    setAutoSaveStatus('pending');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (_normalizeRetailMap(retailMapRef.current) !== lastSavedRef.current) {
        doSave({ silent: true }).catch(() => { /* status set */ });
      }
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [retailMap, loading, doSave]);

  // Flush on tab unmount (e.g. dealer switches to Calculator tab) so the
  // pending debounced save fires immediately, otherwise the calculator would
  // load stale retail prices.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        const snap = _normalizeRetailMap(retailMapRef.current);
        if (snap !== lastSavedRef.current) {
          const payload = { overrides: [] };
          for (const [key, val] of Object.entries(retailMapRef.current || {})) {
            const num = parseInt(val, 10);
            if (!Number.isFinite(num) || num < 0) continue;
            payload.overrides.push({ ...unkeyOf(key), dealerRetailPrice: num, dealerId: '' });
          }
          // fire-and-forget — best effort so the calculator sees fresh data.
          axios.put(`${API}/api/dealer/sauna/overrides`, payload, { headers: dealerAuthHeaders() })
            .catch(() => { /* ignore */ });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyMarkup = async () => {
    const pct = parseFloat(markupPct);
    if (!Number.isFinite(pct)) {
      toast.error('Podaj poprawny procent');
      return;
    }
    setSaving(true);
    try {
      const r = await axios.post(
        `${API}/api/dealer/sauna/overrides/bulk-markup`,
        { percent: pct, base: markupBase, scope: markupScope, overwrite: markupOverwrite },
        { headers: dealerAuthHeaders() },
      );
      toast.success(`Narzut ${pct}% zastosowany`, { description: `Pozycji: ${r.data?.touched ?? 0}` });
      setMarkupOpen(false);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Nie udało się zastosować narzutu');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      toast.error('Podaj nazwę presetu');
      return;
    }
    const pct = parseFloat(markupPct);
    if (!Number.isFinite(pct)) {
      toast.error('Najpierw ustaw procent w panelu narzutu');
      return;
    }
    try {
      await axios.post(
        `${API}/api/dealer/markup-presets`,
        { name, percent: pct, base: markupBase, scope: markupScope },
        { headers: dealerAuthHeaders() },
      );
      toast.success(`Preset „${name}" zapisany`);
      setPresetName('');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Nie udało się zapisać');
    }
  };

  const handleApplyPreset = async (preset) => {
    if (!window.confirm(`Zastosować preset „${preset.name}" (${preset.percent}% od ${preset.base === 'b2b' ? 'B2B' : 'WM Brutto'})? Twoje obecne ceny zostaną nadpisane.`)) return;
    setSaving(true);
    try {
      const r = await axios.post(
        `${API}/api/dealer/markup-presets/${preset.id}/apply`,
        { overwrite: true },
        { headers: dealerAuthHeaders() },
      );
      toast.success(`Preset „${preset.name}" zastosowany`, { description: `Pozycji: ${r.data?.touched ?? 0}` });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Nie udało się zastosować');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePreset = async (preset) => {
    if (!window.confirm(`Usunąć preset „${preset.name}"?`)) return;
    try {
      await axios.delete(`${API}/api/dealer/markup-presets/${preset.id}`, { headers: dealerAuthHeaders() });
      toast.success('Preset usunięty');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Nie udało się usunąć');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!prices) return <div className="text-slate-400 py-10">Nie udało się załadować cennika.</div>;

  // Compute total margin preview for visible rows where retail is set
  const allRows = [];
  (prices.models || []).forEach((m) => {
    allRows.push({ kind: 'model', key: keyOf({ kind: 'model', modelId: m.id }), b2b: m.b2bPrice, baseWm: m.baseRetailWm });
    (m.variants || []).forEach((v) =>
      allRows.push({ kind: 'model_variant', key: keyOf({ kind: 'model_variant', modelId: m.id, variantId: v.id }), b2b: v.b2bPrice, baseWm: v.baseRetailWm }),
    );
  });
  [
    ...(prices.options || []),
    ...(prices.categories || []).flatMap((c) => c.options || []),
  ].forEach((o) => {
    allRows.push({ kind: 'option', key: keyOf({ kind: 'option', optionId: o.id }), b2b: o.b2bPrice, baseWm: o.baseRetailWm });
    (o.variants || []).forEach((v) =>
      allRows.push({ kind: 'option_variant', key: keyOf({ kind: 'option_variant', optionId: o.id, optionVariantId: v.id }), b2b: v.b2bPrice, baseWm: v.baseRetailWm }),
    );
  });
  let coveredRows = 0;
  let avgMarginPct = 0;
  allRows.forEach((r) => {
    const retail = parseInt(retailMap[r.key], 10);
    if (!Number.isFinite(retail) || !r.b2b) return;
    coveredRows += 1;
    avgMarginPct += ((retail - r.b2b) / r.b2b) * 100;
  });
  avgMarginPct = coveredRows ? (avgMarginPct / coveredRows) : 0;

  return (
    <div className="space-y-6" data-testid="dealer-prices-editor">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Moje ceny detaliczne</h2>
          <p className="text-sm text-slate-400 max-w-2xl">
            Ustaw własne ceny dla klientów. Puste pole = używana jest cena bazowa WM (Brutto).
            Kolumna „B2B" to Twój koszt zakupu od WM — różnica = Twoja marża.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {msg && <span className="text-xs text-emerald-400 mr-2">{msg}</span>}
          <DealerAutoSavePill status={autoSaveStatus} />
          <button
            onClick={() => setMarkupOpen((v) => !v)}
            className="px-3 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 text-sm hover:bg-cyan-500/10 flex items-center gap-2"
            data-testid="prices-bulk-markup"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Narzut hurtowo
          </button>
          <button onClick={load} className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/5 flex items-center gap-2" data-testid="prices-reload">
            <RefreshCw className="h-3.5 w-3.5" /> Odśwież
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50" data-testid="prices-save">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Zapisz
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Pozycji z marżą</div>
          <div className="text-2xl font-bold text-white">{coveredRows} <span className="text-xs font-normal text-slate-500">/ {allRows.length}</span></div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Średnia marża %</div>
          <div className={`text-2xl font-bold ${avgMarginPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {avgMarginPct.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-orange-300 mb-1">Wskazówka</div>
          <div className="text-xs text-slate-300 leading-relaxed">
            Ceny B2B ustawia WM. Twoja marża = retail − B2B. Po zapisaniu używamy Twoich cen w kalkulatorze.
          </div>
        </div>
      </div>

      {/* Bulk markup panel */}
      {markupOpen && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3" data-testid="bulk-markup-panel">
          <div className="flex items-center gap-2 text-cyan-300 font-medium">
            <TrendingUp className="h-4 w-4" /> Narzut hurtowo
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Procent %</label>
              <input
                type="number"
                value={markupPct}
                onChange={(e) => setMarkupPct(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400"
                data-testid="bulk-markup-percent"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Od ceny</label>
              <select value={markupBase} onChange={(e) => setMarkupBase(e.target.value)} className="w-full px-3 py-2 rounded-md bg-slate-800 border border-white/10 text-white text-sm" data-testid="bulk-markup-base">
                <option value="b2b">B2B (Twoja cena zakupu)</option>
                <option value="wm">Bazowa WM Brutto</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Zakres</label>
              <select value={markupScope} onChange={(e) => setMarkupScope(e.target.value)} className="w-full px-3 py-2 rounded-md bg-slate-800 border border-white/10 text-white text-sm" data-testid="bulk-markup-scope">
                <option value="all">Wszystko</option>
                <option value="models">Tylko modele</option>
                <option value="options">Tylko opcje</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="markup-overwrite"
                checked={markupOverwrite}
                onChange={(e) => setMarkupOverwrite(e.target.checked)}
                data-testid="bulk-markup-overwrite"
              />
              <label htmlFor="markup-overwrite" className="text-xs text-slate-300">Nadpisz istniejące</label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setMarkupOpen(false)} className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/5">Anuluj</button>
            <button onClick={handleApplyMarkup} disabled={saving} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium disabled:opacity-50" data-testid="bulk-markup-apply">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Zastosuj'}
            </button>
          </div>
          {/* Save current settings as preset */}
          <div className="pt-3 mt-2 border-t border-white/10 flex items-center gap-2 flex-wrap">
            <Bookmark className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nazwa presetu (np. +15% ekonom)"
              className="flex-1 min-w-[180px] px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400"
              data-testid="preset-name-input"
              maxLength={80}
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-3 py-1.5 rounded-md border border-cyan-500/40 text-cyan-300 text-xs hover:bg-cyan-500/10 disabled:opacity-40 flex items-center gap-1"
              data-testid="preset-save-btn"
            >
              <Plus className="h-3 w-3" /> Zapisz jako preset
            </button>
          </div>
        </div>
      )}

      {/* Saved presets */}
      {presets.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="presets-list">
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Zapisane presety</span>
            <span className="ml-auto text-[10px] text-slate-500">jedno kliknięcie zastosuje narzut</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <div
                key={p.id}
                className="group inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 text-sm transition-colors"
                data-testid={`preset-chip-${p.id}`}
              >
                <button
                  onClick={() => handleApplyPreset(p)}
                  disabled={saving}
                  className="px-3 py-1.5 text-cyan-200 hover:text-white flex items-center gap-1.5 disabled:opacity-50"
                  data-testid={`preset-apply-${p.id}`}
                  title={`${p.percent}% od ${p.base === 'b2b' ? 'B2B' : 'WM Brutto'} · ${p.scope}`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-[10px] text-cyan-400/70 font-mono">
                    {p.percent >= 0 ? '+' : ''}{p.percent}%
                  </span>
                </button>
                <button
                  onClick={() => handleDeletePreset(p)}
                  className="px-2 py-1.5 text-cyan-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`preset-delete-${p.id}`}
                  title="Usuń preset"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Models */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">Modele saun</h3>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
          {(prices.models || []).map((m) => (
            <PriceRow
              key={m.id}
              kind="model"
              name={m.name}
              hint={`id: ${m.id}`}
              b2b={m.b2bPrice}
              baseWm={m.baseRetailWm}
              retailKey={keyOf({ kind: 'model', modelId: m.id })}
              retailMap={retailMap}
              onChange={setRetail}
              testid={`row-model-${m.id}`}
              variants={(m.variants || []).map((v) => ({
                name: v.name,
                b2b: v.b2bPrice,
                baseWm: v.baseRetailWm,
                key: keyOf({ kind: 'model_variant', modelId: m.id, variantId: v.id }),
                testid: `row-variant-${m.id}-${v.id}`,
              }))}
            />
          ))}
        </div>
      </section>

      {/* Options */}
      {(() => {
        const allOpts = [
          ...(prices.options || []),
          ...(prices.categories || []).flatMap((c) => c.options || []),
        ];
        if (allOpts.length === 0) return null;
        return (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">Opcje</h3>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
              {allOpts.map((o) => (
                <PriceRow
                  key={o.id}
                  kind="option"
                  name={o.name}
                  hint={`id: ${o.id}`}
                  b2b={o.b2bPrice}
                  baseWm={o.baseRetailWm}
                  retailKey={keyOf({ kind: 'option', optionId: o.id })}
                  retailMap={retailMap}
                  onChange={setRetail}
                  testid={`row-option-${o.id}`}
                  variants={(o.variants || []).map((v) => ({
                    name: v.name,
                    b2b: v.b2bPrice,
                    baseWm: v.baseRetailWm,
                    key: keyOf({ kind: 'option_variant', optionId: o.id, optionVariantId: v.id }),
                    testid: `row-option-variant-${o.id}-${v.id}`,
                  }))}
                />
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}

function PriceRow({ name, hint, b2b, baseWm, retailKey, retailMap, onChange, variants = [], testid }) {
  return (
    <div className="p-4" data-testid={testid}>
      <PriceRowInner name={name} hint={hint} b2b={b2b} baseWm={baseWm} retailKey={retailKey} retailMap={retailMap} onChange={onChange} />
      {variants.length > 0 && (
        <div className="mt-3 ml-4 space-y-3 border-l border-white/10 pl-4">
          {variants.map((v) => (
            <PriceRowInner key={v.key} variant name={v.name} hint="" b2b={v.b2b} baseWm={v.baseWm} retailKey={v.key} retailMap={retailMap} onChange={onChange} testid={v.testid} />
          ))}
        </div>
      )}
    </div>
  );
}

function PriceRowInner({ name, hint, b2b, baseWm, retailKey, retailMap, onChange, variant = false, testid }) {
  const retailStr = retailMap[retailKey] ?? '';
  const retailNum = parseInt(retailStr, 10);
  const hasRetail = Number.isFinite(retailNum);
  const margin = (hasRetail && b2b) ? retailNum - b2b : null;
  const marginPct = (hasRetail && b2b) ? ((retailNum - b2b) / b2b) * 100 : null;
  return (
    <div className="flex items-center gap-3 flex-wrap" data-testid={testid}>
      <div className="flex-1 min-w-[180px]">
        <div className={`text-${variant ? 'sm' : 'base'} text-${variant ? 'slate-300' : 'white'} font-medium`}>
          {variant ? '└ ' : ''}{name}
        </div>
        {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-slate-500 uppercase tracking-wider">B2B</span>
        <span className="px-2 py-1 rounded-md bg-slate-800 border border-white/10 text-cyan-300 font-mono">
          {b2b ? Number(b2b).toLocaleString('pl-PL').replace(/,/g, ' ') : '—'}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Retail</span>
        <input
          type="number"
          min="0"
          value={retailStr}
          placeholder={String(baseWm || 0)}
          onChange={(e) => onChange(retailKey, e.target.value)}
          className="w-28 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-400"
          data-testid={`retail-input-${retailKey}`}
        />
      </div>
      <div className={`min-w-[110px] text-right text-xs font-mono ${
        margin === null ? 'text-slate-600' : margin >= 0 ? 'text-emerald-300' : 'text-red-300'
      }`}>
        {margin === null ? '—' : `${margin >= 0 ? '+' : ''}${margin.toLocaleString('pl-PL').replace(/,/g, ' ')} PLN`}
        {marginPct !== null && (
          <div className="text-[10px] text-slate-500">{marginPct.toFixed(1)}%</div>
        )}
      </div>
    </div>
  );
}

function keyOf(o) {
  return [o.kind, o.modelId || '', o.variantId || '', o.optionId || '', o.optionVariantId || ''].join('|');
}
function unkeyOf(k) {
  const [kind, modelId, variantId, optionId, optionVariantId] = k.split('|');
  return {
    kind,
    modelId: modelId || null,
    variantId: variantId || null,
    optionId: optionId || null,
    optionVariantId: optionVariantId || null,
  };
}

// ==================== Calculator Tab ====================
function CalculatorTab({ editingDraft, onEditDone }) {
  return <DealerCalculatorWrapper initialDraft={editingDraft} onDone={onEditDone} key={editingDraft?.id || 'new'} />;
}

// ==================== Main Dealer App ====================
export default function DealerApp() {
  const [tab, setTab] = useState('calculator');
  const [dealer, setDealer] = useState(getDealerInfo());
  const [editingDraft, setEditingDraft] = useState(null);
  const [ordersReloadKey, setOrdersReloadKey] = useState(0);

  useEffect(() => {
    // refresh dealer info on mount
    fetchDealerMe().then(setDealer).catch(() => {
      clearDealerSession();
      window.location.reload();
    });
  }, []);

  const handleLogout = () => {
    clearDealerSession();
    window.location.reload();
  };

  const handleEditDraft = (draft) => {
    setEditingDraft(draft);
    setTab('calculator');
  };

  const handleEditDone = () => {
    setEditingDraft(null);
    setOrdersReloadKey((k) => k + 1);
    setTab('orders');
  };

  const tabs = useMemo(() => ([
    { id: 'calculator', label: 'Kalkulator', icon: CalcIcon },
    { id: 'orders', label: 'Zamówienia', icon: Package },
    { id: 'prices', label: 'Mój cennik', icon: Settings },
    { id: 'stats', label: 'Statystyki', icon: BarChart3 },
  ]), []);

  return (
    <div className="min-h-screen text-slate-100 relative" style={{ background: '#0b1020' }} data-testid="dealer-app">
      <div className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-20" style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 60%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-15" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 60%)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl" style={{ background: 'rgba(11,16,32,0.7)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">ALICOR SPA · Dealer Portal</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{dealer?.name || dealer?.username || 'dealer'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GlobalSyncPill />
            <button onClick={handleLogout} data-testid="dealer-logout" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-sm text-slate-300 hover:bg-white/5">
              <LogOut className="h-4 w-4" /> Wyloguj
            </button>
          </div>
        </div>
      </header>

      {/* Tabs nav */}
      <nav className="relative z-10 border-b border-white/5 bg-white/[0.015] backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Ic = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`dealer-tab-${t.id}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id ? 'border-orange-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Ic className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {tab === 'stats' && <StatsTab />}
        {tab === 'orders' && <OrdersTab onEditDraft={handleEditDraft} reloadKey={ordersReloadKey} />}
        {tab === 'prices' && <PricesTab />}
        {tab === 'calculator' && <CalculatorTab editingDraft={editingDraft} onEditDone={handleEditDone} />}
      </main>
    </div>
  );
}

/**
 * Dealer-themed (dark) variant of the auto-save status pill. Mirrors the
 * one in TechCardEditor / Cennik for UX consistency. Sits next to the manual
 * "Zapisz" button on the "Moje ceny detaliczne" tab.
 */
function DealerAutoSavePill({ status }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30" data-testid="dealer-prices-autosave-pending">
        <RefreshCw className="h-3 w-3" /> Nie zapisano
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30" data-testid="dealer-prices-autosave-saving">
        <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" data-testid="dealer-prices-autosave-saved">
        <Cloud className="h-3 w-3" /> Auto-zapis
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-red-500/15 text-red-300 border border-red-500/30" data-testid="dealer-prices-autosave-error">
        <CloudOff className="h-3 w-3" /> Błąd
      </span>
    );
  }
  return null;
}

