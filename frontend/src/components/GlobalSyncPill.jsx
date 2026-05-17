import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Loader2, Check } from 'lucide-react';
import { subscribeSync } from '../utils/syncStatus';

/**
 * Global auto-save health pill, intended for the top header.
 *
 * Subscribes to the module-level sync registry that `setSyncStatus()` calls
 * from every auto-saving screen (Cennik, TechCards, Dealer prices). Renders
 * the worst current state so the user always sees one truthful summary at a
 * glance — handy for slow networks where individual silent saves can hang.
 *
 * Hidden when there's nothing to report (no active auto-save scopes).
 */
export default function GlobalSyncPill({ className = '', compact = false }) {
  const [snap, setSnap] = useState({ overall: 'idle', pendingCount: 0, savingCount: 0, errorCount: 0, scopes: 0 });

  useEffect(() => subscribeSync(setSnap), []);

  // Nothing currently registered → hide.
  if (snap.scopes === 0) return null;
  // Quiescent (everything saved) → still show a subtle confirmation for ~3s
  // after activity, but if nothing's happening, render a tiny green dot only.
  if (snap.overall === 'idle' || snap.overall === 'saved') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 ${className}`}
        title="Все изменения сохранены"
        data-testid="global-sync-pill"
        data-status="saved"
      >
        <Check className="h-3 w-3" />
        {!compact && <span>Синхронизировано</span>}
      </span>
    );
  }

  if (snap.overall === 'error') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 animate-pulse ${className}`}
        title={`Ошибка автосохранения (${snap.errorCount}). Проверьте интернет.`}
        data-testid="global-sync-pill"
        data-status="error"
      >
        <CloudOff className="h-3 w-3" />
        {!compact && <span>Ошибка автосохранения</span>}
      </span>
    );
  }

  if (snap.overall === 'saving') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 ${className}`}
        title="Сохранение изменений…"
        data-testid="global-sync-pill"
        data-status="saving"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {!compact && <span>Сохранение…</span>}
      </span>
    );
  }

  // pending
  const total = snap.pendingCount + snap.savingCount;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 ${className}`}
      title={`${total} несохранённых изменения`}
      data-testid="global-sync-pill"
      data-status="pending"
    >
      <RefreshCw className="h-3 w-3" />
      {!compact && <span>Несохранено{total > 1 ? ` (${total})` : ''}</span>}
    </span>
  );
}
