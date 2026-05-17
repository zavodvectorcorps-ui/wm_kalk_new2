/**
 * Tiny module-level pub/sub for the global "Sync health" indicator.
 *
 * Every auto-save site (TechCardEditor, Cennik, Dealer Prices) reports its
 * status by calling `setSyncStatus(scope, status)`. The header pill subscribes
 * via `subscribeSync(cb)` and aggregates the worst current state across all
 * scopes so the user always sees one truthful summary.
 *
 *   scope:   stable string id, e.g. 'cennik', 'techcard:<id>', 'dealer-prices'
 *   status:  'idle' | 'pending' | 'saving' | 'saved' | 'error'
 *
 * When a scope unmounts it should call `clearSyncStatus(scope)` so its row
 * stops affecting the aggregate.
 *
 * Priority (worst wins): error > pending > saving > saved > idle.
 */
const _scopes = new Map();          // scope -> status
const _listeners = new Set();

const PRIORITY = { error: 4, pending: 3, saving: 2, saved: 1, idle: 0 };

function _aggregate() {
  let worstName = 'idle';
  let worstScore = 0;
  let pendingCount = 0;
  let savingCount = 0;
  let errorCount = 0;
  for (const status of _scopes.values()) {
    if (status === 'pending') pendingCount += 1;
    else if (status === 'saving') savingCount += 1;
    else if (status === 'error') errorCount += 1;
    const score = PRIORITY[status] ?? 0;
    if (score > worstScore) { worstScore = score; worstName = status; }
  }
  return {
    overall: worstName,
    pendingCount,
    savingCount,
    errorCount,
    scopes: _scopes.size,
  };
}

function _notify() {
  const snap = _aggregate();
  _listeners.forEach((cb) => { try { cb(snap); } catch (_e) { /* ignore */ } });
}

export function setSyncStatus(scope, status) {
  if (!scope) return;
  const prev = _scopes.get(scope);
  if (prev === status) return;
  _scopes.set(scope, status);
  _notify();
}

export function clearSyncStatus(scope) {
  if (!scope) return;
  if (!_scopes.has(scope)) return;
  _scopes.delete(scope);
  _notify();
}

export function subscribeSync(cb) {
  _listeners.add(cb);
  // Push current state right away so the subscriber doesn't render blank.
  try { cb(_aggregate()); } catch (_e) { /* ignore */ }
  return () => { _listeners.delete(cb); };
}

export function getSyncSnapshot() {
  return _aggregate();
}
