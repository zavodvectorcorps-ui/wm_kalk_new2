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
  return r.data.dealer;
}

export async function fetchDealerMe() {
  const r = await axios.get(`${API}/api/dealer/auth/me`, { headers: dealerAuthHeaders() });
  return r.data;
}
