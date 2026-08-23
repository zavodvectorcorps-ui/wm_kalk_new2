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

/**
 * Normalize a media/image URL so it always resolves against the CURRENT host.
 * Historically some image URLs were saved as absolute links to old preview
 * domains (e.g. https://sauna-catalog.preview.emergentagent.com/api/uploads/xxx).
 * Those 404 on production. The underlying file lives in the app's own DB and is
 * served from /api/uploads/ on whatever host we're on, so we rewrite any such
 * absolute link to the current backend origin. External URLs (imgur, cloudinary,
 * data URIs) are returned untouched.
 */
export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:')) return url;
  const base = getApiUrl();
  // Relative path served by our backend
  if (url.startsWith('/api/uploads/') || url.startsWith('/api/static/')) {
    return `${base}${url}`;
  }
  // Absolute URL that points at our upload/static route on some (possibly stale) host
  const marker = url.indexOf('/api/uploads/') !== -1
    ? '/api/uploads/'
    : (url.indexOf('/api/static/') !== -1 ? '/api/static/' : null);
  if (marker && /^https?:\/\//i.test(url)) {
    const path = url.slice(url.indexOf(marker));
    return `${base}${path}`;
  }
  return url;
};

export default API_URL;
