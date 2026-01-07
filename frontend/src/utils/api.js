/**
 * API URL utilities - auto-detect correct backend URL
 * This ensures the frontend uses the correct API URL even on production
 */

// Smart API URL detection - use current origin on production, env var for development
export const getApiUrl = () => {
  // If we're on the production domain or emergent host, use current origin
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // Production domains
    if (origin.includes('wm-kalkulator.pl')) {
      return origin;
    }
    // Emergent hosting domains (various patterns)
    if (origin.includes('.emergent.host') || origin.includes('.emergentagent.com')) {
      return origin;
    }
  }
  // Fallback to env var for local development
  return process.env.REACT_APP_BACKEND_URL || '';
};

// Export default API URL
export const API_URL = getApiUrl();

export default API_URL;
