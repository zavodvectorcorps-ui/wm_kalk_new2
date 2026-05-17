/**
 * Dealer authentication helper — JWT stored in localStorage under 'dealerToken'.
 */
import axios from 'axios';
import { getApiUrl } from './api';

const API = getApiUrl();

const TOKEN_KEY = 'dealerToken';
const DEALER_KEY = 'dealerInfo';

export function getDealerToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (_e) { return null; }
}

export function getDealerInfo() {
  try {
    const raw = localStorage.getItem(DEALER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) { return null; }
}

export function setDealerSession(token, dealer) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(DEALER_KEY, JSON.stringify(dealer || {}));
}

export function clearDealerSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DEALER_KEY);
}

export function dealerAuthHeaders() {
  const t = getDealerToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function dealerLogin(username, password) {
  const r = await axios.post(`${API}/api/dealer/auth/login`, { username, password });
  setDealerSession(r.data.token, r.data.dealer);
  // Surface a friendly onboarding toast if the backend just applied the
  // admin-configured default markup on the first login.
  if (r.data.onboardingApplied) {
    try {
      const { toast } = await import('sonner');
      const o = r.data.onboardingApplied;
      toast.success(`Witaj! Twoje ceny zostały automatycznie ustawione`, {
        description: `Narzut ${o.percent}% od ${o.base === 'b2b' ? 'cen B2B' : 'cen WM Brutto'} zastosowany do ${o.touched} pozycji. Możesz je edytować w zakładce „Mój cennik".`,
        duration: 8000,
      });
    } catch (_e) { /* sonner missing? silent. */ }
  }
  return r.data.dealer;
}

export async function fetchDealerMe() {
  const r = await axios.get(`${API}/api/dealer/auth/me`, { headers: dealerAuthHeaders() });
  return r.data;
}
