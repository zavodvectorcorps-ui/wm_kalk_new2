/**
 * PublicOfferPage
 *
 * Public, no-auth, mobile-first page that a dealer can share with their
 * customer (link copied from the dealer panel). The customer sees a clean
 * commercial offer + a "Potwierdzam zamówienie" button which signals the
 * dealer & WM that the customer agrees, before any internal CRM submission.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Loader2, Phone, Calendar, Package, Sparkles } from 'lucide-react';
import { getApiUrl } from '../utils/api';

const API = getApiUrl();

const fmtPLN = (v) => {
  const n = Math.round(Number(v || 0));
  return `${n.toLocaleString('pl-PL').replace(/,/g, ' ')} PLN`;
};

const fmtDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('pl-PL'); } catch (_e) { return ''; }
};

export default function PublicOfferPage() {
  const orderId = (window.location.pathname.match(/\/oferta\/([^/?#]+)/) || [])[1] || '';
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!orderId) { setError('Brak numeru oferty w adresie.'); setLoading(false); return; }
    axios.get(`${API}/api/public/dealer-offer/${orderId}`)
      .then((r) => {
        setOffer(r.data);
        if (r.data?.clientConfirmedByLink) setConfirmed(true);
      })
      .catch((e) => setError(e?.response?.data?.detail || 'Nie znaleziono oferty.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await axios.post(`${API}/api/public/dealer-offer/${orderId}/confirm`, { note });
      setConfirmed(true);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Nie udało się potwierdzić.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-3">😕</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Oferta niedostępna</h1>
          <p className="text-sm text-slate-500">{error || 'Spróbuj odświeżyć stronę lub skontaktuj się z dealerem.'}</p>
        </div>
      </div>
    );
  }

  const dealerName = offer.dealer?.name || 'WM Saunas';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/40">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold">
              W
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm leading-tight">{dealerName}</div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Oferta handlowa</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs text-slate-400">{offer.id}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
              <Calendar className="h-3 w-3" /> {fmtDate(offer.createdAt)}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <section className="text-center space-y-2 py-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
            <Sparkles className="h-3 w-3" /> Dla {offer.customerName || 'Państwa'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight" data-testid="offer-title">
            Twoja sauna
          </h1>
          <p className="text-slate-500 max-w-md mx-auto text-sm">
            Indywidualna oferta przygotowana przez {dealerName}. Sprawdź konfigurację i potwierdź zamówienie jednym kliknięciem.
          </p>
        </section>

        {/* Model card */}
        <section className="bg-white rounded-2xl shadow-md shadow-slate-200/40 border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 px-6 py-5 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-orange-600 font-semibold mb-1">Model</div>
                <div className="text-xl font-bold text-slate-800">{offer.modelName || '—'}</div>
                {offer.variantName && (
                  <div className="text-sm text-slate-600 mt-0.5">Wariant: <b>{offer.variantName}</b></div>
                )}
              </div>
              <Package className="h-10 w-10 text-orange-400/60 shrink-0" />
            </div>
          </div>

          {/* Options table */}
          {offer.options && offer.options.length > 0 && (
            <div className="px-6 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-2">Wyposażenie i opcje</div>
              <div className="divide-y divide-slate-100">
                {offer.options.map((o, idx) => (
                  <div key={idx} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                    <div className="text-slate-700">
                      {o.optionName}
                      {o.categoryName && <span className="text-xs text-slate-400 ml-1">· {o.categoryName}</span>}
                      {o.quantity > 1 && <span className="text-slate-500"> × {o.quantity}</span>}
                    </div>
                    <div className="font-medium text-slate-700 shrink-0">{fmtPLN(o.totalPrice || o.price)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex items-baseline justify-between">
            <div className="text-sm text-slate-600">Łącznie do zapłaty:</div>
            <div className="text-2xl font-bold text-orange-600" data-testid="offer-total">{fmtPLN(offer.total)}</div>
          </div>
        </section>

        {/* Notes from dealer */}
        {offer.notes && (
          <section className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-2">Komentarz dealera</div>
            <p className="text-sm text-slate-600 whitespace-pre-line">{offer.notes}</p>
          </section>
        )}

        {/* Confirm CTA */}
        {!confirmed ? (
          <section className="bg-white rounded-2xl border-2 border-orange-200 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Wszystko się zgadza?</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Klikając "Potwierdzam zamówienie", informujesz {dealerName} o swojej zgodzie i akceptujesz wycenę. To nie jest jeszcze finalna umowa — dealer skontaktuje się z Tobą w celu finalizacji.
              </p>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
                Komentarz (opcjonalnie)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Np. preferowany termin dostawy, dodatkowe pytania…"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                data-testid="offer-client-note"
              />
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-200 disabled:opacity-60"
              data-testid="offer-confirm-button"
            >
              {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Potwierdzam zamówienie
            </button>
          </section>
        ) : (
          <section className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 text-center" data-testid="offer-confirmed">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Dziękujemy!</h2>
            <p className="text-slate-600">
              Twoje potwierdzenie zostało przekazane do <b>{dealerName}</b>.<br />
              Skontaktują się z Tobą w ciągu 24 godzin.
            </p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500">
              <Phone className="h-3 w-3" />
              W razie pytań — odpisz na otrzymaną wiadomość lub zadzwoń do dealera.
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-slate-400 pt-4 pb-8">
          Powered by <span className="font-semibold text-slate-500">WM Kalkulator</span> · oferta ważna 14 dni
        </footer>
      </main>
    </div>
  );
}
