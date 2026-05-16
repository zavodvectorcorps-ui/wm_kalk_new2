import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Building2, Plus, Trash2, Save, Loader2, Power, PowerOff, Copy, ShoppingCart, Pencil } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import PriceImportExport from './sauna-pricing/PriceImportExport';

const API = getApiUrl();

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function DealersAdminPage() {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editDealer, setEditDealer] = useState(null); // dealer being edited
  const [pricesModal, setPricesModal] = useState(null); // {dealer}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/admin/dealers`, { headers: authHeaders() });
      setDealers(r.data.dealers || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (d) => {
    try {
      if (d.isActive) {
        await axios.delete(`${API}/api/admin/dealers/${d.id}`, { headers: authHeaders() });
        toast.success('Дилер деактивирован');
      } else {
        await axios.put(`${API}/api/admin/dealers/${d.id}`, { isActive: true }, { headers: authHeaders() });
        toast.success('Дилер активирован');
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    }
  };

  const copyLoginLink = (d) => {
    const host = window.location.hostname;
    // Production: dealer.* OR wm-dealers.* — fallback to /dealer on current domain
    const url = host.includes('wm-kalkulator.pl')
      ? `https://wm-kalkulator.pl/dealer`
      : `${window.location.origin}/dealer`;
    navigator.clipboard.writeText(url);
    toast.success(`Ссылка скопирована: ${url}`);
  };

  return (
    <div className="space-y-6" data-testid="dealers-admin">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-orange-500" />
            Дилеры
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Управление дилерскими аккаунтами. Каждый дилер получает свой кабинет по ссылке /dealer и может устанавливать свои цены.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PriceImportExport />
          <Button onClick={() => setShowCreate(true)} className="bg-orange-500 hover:bg-orange-600" data-testid="create-dealer-btn">
            <Plus className="h-4 w-4 mr-1" /> Новый дилер
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : dealers.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-muted-foreground" data-testid="dealers-empty">
          <Building2 className="h-10 w-10 mx-auto mb-4 opacity-40" />
          <div>Дилеров пока нет. Создайте первого!</div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Логин / Компания</th>
                <th className="text-left px-4 py-3">Контакты</th>
                <th className="text-right px-4 py-3">Заказов</th>
                <th className="text-left px-4 py-3">Статус</th>
                <th className="text-right px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {dealers.map((d) => (
                <tr key={d.id} className="border-t hover:bg-muted/20" data-testid={`dealer-row-${d.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.name || '—'}</div>
                    <div className="text-xs text-muted-foreground font-mono">@{d.username}</div>
                    {d.orderPrefix && (
                      <div className="text-[11px] text-orange-600 font-mono mt-0.5">Префикс: {d.orderPrefix}-</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{d.email || '—'}</div>
                    <div>{d.phone || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold">
                      <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                      {d.orderCount || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {d.isActive
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Power className="h-3 w-3" /> Активен</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-red-500"><PowerOff className="h-3 w-3" /> Отключён</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditDealer(d)} title="Редактировать" data-testid={`edit-dealer-${d.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyLoginLink(d)} title="Скопировать ссылку для входа" data-testid={`copy-link-${d.id}`}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPricesModal({ dealer: d })} title="Настроить цены" data-testid={`prices-${d.id}`}>
                        Цены
                      </Button>
                      <Button size="sm" variant={d.isActive ? 'outline' : 'default'} onClick={() => toggleActive(d)} data-testid={`toggle-${d.id}`}>
                        {d.isActive ? <Trash2 className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDealerDialog open={showCreate} onClose={() => { setShowCreate(false); load(); }} />
      {editDealer && (
        <EditDealerDialog
          dealer={editDealer}
          onClose={() => { setEditDealer(null); load(); }}
        />
      )}
      {pricesModal && (
        <DealerPricesDialog
          dealer={pricesModal.dealer}
          onClose={() => setPricesModal(null)}
        />
      )}
    </div>
  );
}

function CreateDealerDialog({ open, onClose }) {
  const [data, setData] = useState({ username: '', password: '', name: '', email: '', phone: '', orderPrefix: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/api/admin/dealers`, data, { headers: authHeaders() });
      toast.success(`Дилер ${data.username} создан`);
      setData({ username: '', password: '', name: '', email: '', phone: '', orderPrefix: '' });
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="create-dealer-dialog">
        <DialogHeader><DialogTitle>Новый дилер</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Логин *</Label>
              <Input value={data.username} onChange={(e) => setData({ ...data, username: e.target.value })} placeholder="dealer-kraków" data-testid="create-dealer-username" />
            </div>
            <div>
              <Label>Пароль *</Label>
              <Input type="text" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} placeholder="минимум 6 символов" data-testid="create-dealer-password" />
            </div>
          </div>
          <div>
            <Label>Название компании</Label>
            <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="ABC Sauny Sp. z o.o." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
            </div>
            <div>
              <Label>Телефон</Label>
              <Input value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Префикс заказа</Label>
            <Input
              value={data.orderPrefix}
              onChange={(e) => setData({ ...data, orderPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
              placeholder="Напр. ABC — номер заказа станет ABC-A1B2C3D4"
              maxLength={10}
              data-testid="create-dealer-prefix"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Необязательно. Если пусто — используется префикс WMS-D.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving || !data.username || !data.password} className="bg-orange-500 hover:bg-orange-600" data-testid="create-dealer-save">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDealerDialog({ dealer, onClose }) {
  const [data, setData] = useState({
    name: dealer.name || '',
    email: dealer.email || '',
    phone: dealer.phone || '',
    orderPrefix: dealer.orderPrefix || '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        orderPrefix: data.orderPrefix,
      };
      if (data.password && data.password.trim().length > 0) {
        payload.password = data.password;
      }
      await axios.put(`${API}/api/admin/dealers/${dealer.id}`, payload, { headers: authHeaders() });
      toast.success('Изменения сохранены');
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="edit-dealer-dialog">
        <DialogHeader><DialogTitle>Редактировать дилера: @{dealer.username}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Название компании</Label>
            <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
            </div>
            <div>
              <Label>Телефон</Label>
              <Input value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Префикс заказа</Label>
            <Input
              value={data.orderPrefix}
              onChange={(e) => setData({ ...data, orderPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
              placeholder="Напр. ABC — номер заказа станет ABC-XXXXXXXX"
              maxLength={10}
              data-testid="edit-dealer-prefix"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Пусто — используется префикс WMS-D. Меняется только для НОВЫХ заказов, старые остаются.</p>
          </div>
          <div>
            <Label>Новый пароль (опционально)</Label>
            <Input
              type="text"
              value={data.password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              placeholder="Оставьте пустым, чтобы не менять"
              data-testid="edit-dealer-password"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="edit-dealer-save">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealerPricesDialog({ dealer, onClose }) {
  const [prices, setPrices] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const keyOf = (o) => [o.kind, o.modelId || '', o.variantId || '', o.optionId || '', o.optionVariantId || ''].join('|');
  const unkeyOf = (k) => {
    const [kind, modelId, variantId, optionId, optionVariantId] = k.split('|');
    return { kind, modelId: modelId || null, variantId: variantId || null, optionId: optionId || null, optionVariantId: optionVariantId || null };
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, o] = await Promise.all([
          axios.get(`${API}/api/sauna/prices`, { headers: authHeaders() }),
          axios.get(`${API}/api/admin/dealers/${dealer.id}/overrides`, { headers: authHeaders() }),
        ]);
        setPrices(p.data);
        const m = {};
        (o.data.overrides || []).forEach((ov) => { m[keyOf(ov)] = String(ov.price); });
        setOverrides(m);
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Ошибка');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealer.id]);

  const setPrice = (key, val) => setOverrides((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { overrides: [] };
      for (const [key, val] of Object.entries(overrides)) {
        const num = parseInt(val, 10);
        if (!Number.isFinite(num) || num < 0) continue;
        payload.overrides.push({ ...unkeyOf(key), price: num, dealerId: dealer.id });
      }
      await axios.put(`${API}/api/admin/dealers/${dealer.id}/overrides`, payload, { headers: authHeaders() });
      toast.success(`Сохранено (${payload.overrides.length} позиций)`);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dealer-prices-dialog">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>Цены дилера: {dealer.name || dealer.username}</DialogTitle>
            <PriceImportExport
              dealerId={dealer.id}
              dealerName={dealer.name || dealer.username}
              onImported={() => window.location.reload()}
            />
          </div>
        </DialogHeader>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !prices ? (
          <div className="text-center text-muted-foreground py-6">Нет данных прайса</div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">Пустое поле = используется базовая цена. Дилер сможет позже откорректировать эти цены у себя.</p>
            <h4 className="text-sm font-semibold">Модели</h4>
            <div className="space-y-2 rounded border divide-y">
              {(prices.models || []).map((m) => (
                <div key={m.id} className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground">Базовая: {m.basePrice} PLN</div>
                    </div>
                    <Input
                      type="number"
                      placeholder={String(m.basePrice || 0)}
                      value={overrides[keyOf({ kind: 'model', modelId: m.id })] ?? ''}
                      onChange={(e) => setPrice(keyOf({ kind: 'model', modelId: m.id }), e.target.value)}
                      className="w-32"
                      data-testid={`admin-model-price-${m.id}`}
                    />
                  </div>
                  {(m.variants || []).length > 0 && (
                    <div className="ml-4 mt-2 pl-3 border-l space-y-2">
                      {m.variants.map((v) => (
                        <div key={v.id} className="flex items-center gap-2">
                          <div className="flex-1 text-xs text-muted-foreground">└ {v.name} (базовая: {v.price} PLN)</div>
                          <Input
                            type="number"
                            placeholder={String(v.price || 0)}
                            value={overrides[keyOf({ kind: 'model_variant', modelId: m.id, variantId: v.id })] ?? ''}
                            onChange={(e) => setPrice(keyOf({ kind: 'model_variant', modelId: m.id, variantId: v.id }), e.target.value)}
                            className="w-32 h-8"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(() => {
              const allOpts = [
                ...(prices.options || []),
                ...(prices.categories || []).flatMap((c) => c.options || []),
              ];
              if (allOpts.length === 0) return null;
              return (
                <>
                  <h4 className="text-sm font-semibold pt-3">Опции</h4>
                  <div className="space-y-2 rounded border divide-y">
                    {allOpts.map((o) => (
                      <div key={o.id} className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex-1 min-w-[200px]">
                            <div className="text-sm font-medium">{o.name}</div>
                            <div className="text-[11px] text-muted-foreground">Базовая: {o.price} PLN</div>
                          </div>
                          <Input
                            type="number"
                            placeholder={String(o.price || 0)}
                            value={overrides[keyOf({ kind: 'option', optionId: o.id })] ?? ''}
                            onChange={(e) => setPrice(keyOf({ kind: 'option', optionId: o.id }), e.target.value)}
                            className="w-32"
                          />
                        </div>
                        {(o.variants || []).length > 0 && (
                          <div className="ml-4 mt-2 pl-3 border-l space-y-2">
                            {o.variants.map((v) => (
                              <div key={v.id} className="flex items-center gap-2">
                                <div className="flex-1 text-xs text-muted-foreground">└ {v.name} (базовая: {v.price} PLN)</div>
                                <Input
                                  type="number"
                                  placeholder={String(v.price || 0)}
                                  value={overrides[keyOf({ kind: 'option_variant', optionId: o.id, optionVariantId: v.id })] ?? ''}
                                  onChange={(e) => setPrice(keyOf({ kind: 'option_variant', optionId: o.id, optionVariantId: v.id }), e.target.value)}
                                  className="w-32 h-8"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="save-dealer-prices">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
