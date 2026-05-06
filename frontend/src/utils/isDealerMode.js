/**
 * Check if the current request should render the dealer portal.
 * Activates when:
 *  - hostname contains "dealer" or equals the configured dealer domain (wm-dealers.pl etc.)
 *  - OR pathname starts with "/dealer" (for preview/testing without DNS setup)
 */
export function isDealerMode() {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  const path = window.location.pathname || '';
  if (host.startsWith('dealer.')) return true;
  if (host.includes('wm-dealer') || host.includes('dealers.')) return true;
  if (path.startsWith('/dealer')) return true;
  return false;
}
