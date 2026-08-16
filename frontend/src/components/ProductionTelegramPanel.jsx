import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Send, Loader2, FileText, File, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Shared Telegram-production info panel: ack status, dates, photo gallery,
 * message feed + composer, full-history dialog (search + PDF/TXT export + reply).
 * Used in both the CRM card and the Production card so they stay in sync.
 */
export const ProductionTelegramPanel = ({ order, authHeaders, onUpdated }) => {
  const [lead, setLead] = useState(order || {});
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState({ open: false, photos: [], index: 0 });

  useEffect(() => { setLead(order || {}); }, [order?.id, order?.productionMessages?.length, order?.lastProductionUpdateAt, order?.productionAckedAt]);

  // Mark production updates as seen when opening a card that has unseen updates
  useEffect(() => {
    if (!order?.id) return;
    const unseen = order.lastProductionUpdateAt &&
      (!order.productionUpdatesSeenAt || new Date(order.lastProductionUpdateAt) > new Date(order.productionUpdatesSeenAt));
    if (unseen) {
      fetch(`${API_URL}/api/integrations/telegram/mark-seen/${order.id}`, { method: 'POST', headers: authHeaders })
        .then(() => { try { window.dispatchEvent(new Event('prod-updates-seen')); } catch {} })
        .catch(() => {});
    }
  }, [order?.id]);

  if (!lead?.telegram_topic_id) return null;

  const photos = (lead.documents || []).filter(d => d.type === 'production_photo' && d.url);
  const messages = lead.productionMessages || [];

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    let author = 'Менеджер';
    try { author = (JSON.parse(localStorage.getItem('authUser') || '{}').username) || 'Менеджер'; } catch {}
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/telegram/send-message/${lead.id}`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msgText.trim(), author }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Сообщение отправлено в тему');
        const updated = { ...lead, productionMessages: [...messages, data.entry] };
        setLead(updated);
        setMsgText('');
        if (onUpdated) onUpdated(updated);
      } else {
        toast.error(data.detail || 'Ошибка отправки');
      }
    } catch { toast.error('Ошибка сети'); }
    setSending(false);
  };

  const q = search.trim().toLowerCase();
  const filtered = messages.filter(m => !q || (m.text || '').toLowerCase().includes(q) || (m.author || '').toLowerCase().includes(q));

  return (
    <div data-testid="prod-tg-panel">
      {/* Ack status + dates */}
      <div className="text-xs" data-testid="prod-ack-status">
        {lead.productionAckedAt ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            ✅ Производство приняло: <b>{lead.productionAckedBy || '—'}</b> · {new Date(lead.productionAckedAt).toLocaleString('ru-RU')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
            ⏳ Ожидает подтверждения производства
          </span>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-muted-foreground">
          {lead.plannedStartDate && <span>Плановый старт: <b>{new Date(lead.plannedStartDate).toLocaleDateString('ru-RU')}</b></span>}
          {lead.productionDate && <span>Дата производства: <b>{new Date(lead.productionDate).toLocaleDateString('ru-RU')}</b></span>}
        </div>
        {lead.productionComment && (
          <div className="mt-1 text-muted-foreground">Комментарий производства: <span className="text-foreground">{lead.productionComment}</span></div>
        )}
      </div>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="mt-2" data-testid="production-photo-gallery">
          <div className="text-[11px] font-medium text-foreground mb-1">📷 Фото от производства</div>
          <div className="flex flex-wrap gap-2">
            {photos.map((d, i) => (
              <button key={d.id || i} type="button"
                onClick={() => setLightbox({ open: true, photos, index: i })}
                className="block w-16 h-16 rounded-md overflow-hidden border hover:ring-2 hover:ring-sky-400 transition"
                title={d.name || 'Фото производства'} data-testid={`production-photo-${i}`}>
                <img src={d.url} alt={d.name || 'Фото'} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="mt-3" data-testid="prod-messages-section">
        <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Send className="w-4 h-4 text-sky-600" />Сообщения производству
          {messages.length > 0 && (
            <button type="button" onClick={() => { setSearch(''); setHistoryOpen(true); }}
              className="ml-auto text-[11px] font-normal text-sky-600 hover:underline" data-testid="open-chat-history-btn">
              Вся переписка ({messages.length})
            </button>
          )}
        </Label>
        {messages.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2 pr-1">
            {messages.map((m, i) => (
              <div key={i} className="text-xs p-2 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span className="font-medium">{m.author || 'Менеджер'}{m.direction === 'in' ? ' · из Telegram' : ''}</span>
                  <span>{m.at ? new Date(m.at).toLocaleString('ru-RU') : ''}</span>
                </div>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Написать в тему производства…" rows={2} className="text-sm" data-testid="prod-message-input" />
          <Button size="sm" onClick={sendMessage} disabled={sending || !msgText.trim()} data-testid="prod-message-send">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Full chat history dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="chat-history-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-sky-600" />
              Переписка по заказу {lead.id ? `#${lead.id}` : ''}
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => window.open(`${API_URL}/api/integrations/telegram/export-chat/${lead.id}?format=pdf`, '_blank')}
                  data-testid="export-chat-pdf-btn"><FileText className="w-3.5 h-3.5 mr-1" />PDF</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => window.open(`${API_URL}/api/integrations/telegram/export-chat/${lead.id}?format=txt`, '_blank')}
                  data-testid="export-chat-txt-btn"><File className="w-3.5 h-3.5 mr-1" />TXT</Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Поиск по тексту / автору…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" data-testid="chat-history-search" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filtered.length === 0
              ? <p className="text-center text-muted-foreground py-10 text-sm">{q ? 'Ничего не найдено' : 'Сообщений пока нет'}</p>
              : filtered.map((m, i) => (
                <div key={i} className={`text-sm p-2.5 rounded-lg border ${m.direction === 'in' ? 'bg-sky-50 border-sky-200' : 'bg-muted/30'}`} data-testid={`chat-history-msg-${i}`}>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span className="font-medium">{m.author || 'Менеджер'}{m.direction === 'in' ? ' · из Telegram' : ''}</span>
                    <span>{m.at ? new Date(m.at).toLocaleString('ru-RU') : ''}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              ))}
          </div>
          <div className="flex gap-2 items-end pt-2 border-t mt-2">
            <Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Быстрый ответ в тему производства…" rows={2} className="text-sm" data-testid="chat-history-reply-input" />
            <Button size="sm" onClick={sendMessage} disabled={sending || !msgText.trim()} data-testid="chat-history-reply-send">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo lightbox */}
      {lightbox.open && lightbox.photos.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center" onClick={() => setLightbox(p => ({ ...p, open: false }))} data-testid="photo-lightbox">
          <button className="absolute top-4 right-4 text-white/90 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); setLightbox(p => ({ ...p, open: false })); }} data-testid="lightbox-close"><X className="w-7 h-7" /></button>
          {lightbox.photos.length > 1 && (
            <button className="absolute left-4 text-white/90 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index - 1 + p.photos.length) % p.photos.length })); }} data-testid="lightbox-prev"><ChevronLeft className="w-10 h-10" /></button>
          )}
          <div className="max-w-[85vw] max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.photos[lightbox.index]?.url} alt="Фото производства" className="max-w-[85vw] max-h-[78vh] object-contain rounded-lg" />
            <div className="text-white/80 text-xs mt-2">{lightbox.photos[lightbox.index]?.name || 'Фото производства'} · {lightbox.index + 1}/{lightbox.photos.length}</div>
          </div>
          {lightbox.photos.length > 1 && (
            <button className="absolute right-4 text-white/90 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index + 1) % p.photos.length })); }} data-testid="lightbox-next"><ChevronRight className="w-10 h-10" /></button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductionTelegramPanel;
