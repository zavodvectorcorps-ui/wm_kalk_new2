import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Phone, RefreshCw, Loader2, Wand2, Save, XCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';

const API_URL = getApiUrl();

/**
 * Admin dialog for mapping Binotel employee IDs to amoCRM user IDs.
 * Used by Manager Events Analytics so live phone-system stats can be
 * attributed to the correct manager in the dashboard.
 */
const BinotelMappingDialog = ({ open, onClose, dateFrom, dateTo }) => {
  const [loading, setLoading] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);     // from Binotel /employees
  const [items, setItems] = useState([]);             // current mapping rows
  const [amoUsers, setAmoUsers] = useState([]);
  const [filter, setFilter] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const [empRes, mapRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/api/lead-analytics/binotel/employees`, { params }),
        axios.get(`${API_URL}/api/lead-analytics/binotel/mapping`),
        axios.get(`${API_URL}/api/lead-analytics/binotel/amocrm-users`),
      ]);
      const emps = empRes.data.employees || [];
      const mapping = mapRes.data.items || [];
      const users = usersRes.data.users || [];
      setEmployees(emps);
      setAmoUsers(users);

      // Merge: every Binotel employee gets a row, prefilled from saved mapping.
      const mapById = {};
      mapping.forEach(m => { mapById[m.binotelEmployeeId] = m; });
      const merged = emps.map(e => {
        const saved = mapById[e.binotelEmployeeId];
        return {
          binotelEmployeeId: e.binotelEmployeeId,
          binotelEmployeeName: e.binotelEmployeeName,
          callsInPeriod: e.callsInPeriod,
          amocrmUserId: saved?.amocrmUserId || '',
          amocrmUserName: saved?.amocrmUserName || '',
        };
      });
      // Also include saved mappings for employees that didn't appear in this period
      mapping.forEach(m => {
        if (!merged.find(x => x.binotelEmployeeId === m.binotelEmployeeId)) {
          merged.push({
            binotelEmployeeId: m.binotelEmployeeId,
            binotelEmployeeName: m.binotelEmployeeName,
            callsInPeriod: 0,
            amocrmUserId: m.amocrmUserId || '',
            amocrmUserName: m.amocrmUserName || '',
          });
        }
      });
      merged.sort((a, b) => (b.callsInPeriod || 0) - (a.callsInPeriod || 0));
      setItems(merged);
    } catch (e) {
      toast.error('Не удалось загрузить данные Binotel: ' + (e.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) fetchAll(); /* eslint-disable-line */ }, [open, dateFrom, dateTo]);

  const updateRow = (eid, amocrmUserId) => {
    setItems(prev => prev.map(it => {
      if (it.binotelEmployeeId !== eid) return it;
      const u = amoUsers.find(x => x.id === amocrmUserId);
      return { ...it, amocrmUserId, amocrmUserName: u?.name || '' };
    }));
  };

  const runAutomap = async () => {
    setAutoMapping(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await axios.post(`${API_URL}/api/lead-analytics/binotel/mapping/automap`, null, { params });
      toast.success(`Автоматически сопоставлено: ${res.data.matched} из ${res.data.total}`);
      await fetchAll();
    } catch (e) {
      toast.error('Ошибка автомаппинга: ' + (e.response?.data?.detail || e.message));
    } finally { setAutoMapping(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/lead-analytics/binotel/mapping`, {
        items: items.map(({ binotelEmployeeId, binotelEmployeeName, amocrmUserId, amocrmUserName }) =>
          ({ binotelEmployeeId, binotelEmployeeName, amocrmUserId, amocrmUserName }))
      });
      toast.success('Маппинг сохранён');
      onClose?.();
    } catch (e) {
      toast.error('Не удалось сохранить: ' + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const filtered = filter
    ? items.filter(it =>
        (it.binotelEmployeeName || '').toLowerCase().includes(filter.toLowerCase())
        || (it.binotelEmployeeId || '').includes(filter)
        || (it.amocrmUserName || '').toLowerCase().includes(filter.toLowerCase()))
    : items;

  const mappedCount = items.filter(i => i.amocrmUserId).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="binotel-mapping-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-indigo-600" />
            Сопоставление Binotel ↔ amoCRM
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Чтобы статистика звонков из Binotel корректно отображалась в аналитике
            менеджеров, свяжите каждого сотрудника Binotel с пользователем amoCRM.
            Можно запустить автомаппинг по совпадению имён или сопоставить вручную.
          </p>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Сопоставлено: {mappedCount} / {items.length}</Badge>
            {dateFrom && dateTo && (
              <Badge variant="outline" className="text-[10px]">
                Период: {dateFrom} → {dateTo}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Поиск…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="h-8 w-48"
              data-testid="binotel-mapping-search"
            />
            <Button onClick={fetchAll} variant="outline" size="sm" disabled={loading} data-testid="binotel-mapping-refresh">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button onClick={runAutomap} variant="outline" size="sm" disabled={autoMapping || loading} data-testid="binotel-mapping-automap">
              {autoMapping ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
              Автомаппинг
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {items.length === 0
                ? 'Нет сотрудников Binotel в этот период. Попробуйте другой диапазон дат.'
                : 'Нет совпадений по фильтру.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left py-2 px-2 font-medium">Сотрудник Binotel</th>
                  <th className="text-center py-2 px-2 font-medium w-20">ID</th>
                  <th className="text-center py-2 px-2 font-medium w-24">Звонков</th>
                  <th className="text-left py-2 px-2 font-medium">Пользователь amoCRM</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(it => (
                  <tr key={it.binotelEmployeeId} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-2">{it.binotelEmployeeName || <span className="text-muted-foreground italic">без имени</span>}</td>
                    <td className="text-center py-2 px-2 text-xs text-muted-foreground font-mono">{it.binotelEmployeeId}</td>
                    <td className="text-center py-2 px-2">
                      <Badge variant={it.callsInPeriod > 0 ? 'default' : 'outline'} className="text-[10px]">
                        {it.callsInPeriod}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        value={it.amocrmUserId || '__none__'}
                        onValueChange={v => updateRow(it.binotelEmployeeId, v === '__none__' ? '' : v)}
                      >
                        <SelectTrigger className="h-8" data-testid={`mapping-select-${it.binotelEmployeeId}`}>
                          <SelectValue placeholder="— не сопоставлено —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— не сопоставлено —</SelectItem>
                          {amoUsers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name} <span className="text-muted-foreground text-xs ml-1">#{u.id}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-center py-2 px-1">
                      {it.amocrmUserId
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                        : <XCircle className="h-4 w-4 text-muted-foreground inline" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={save} disabled={saving || loading} data-testid="binotel-mapping-save">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Сохранить маппинг
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BinotelMappingDialog;
