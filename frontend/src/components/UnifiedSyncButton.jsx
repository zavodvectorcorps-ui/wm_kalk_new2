import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';

const API_URL = getApiUrl();

/**
 * Cross-page button + status banner for the "Полная синхронизация" flow
 * that runs lead-analytics sync followed by manager-events sync.
 *
 * Props:
 *   dateFrom, dateTo — ISO date strings (YYYY-MM-DD) for both sub-syncs.
 *   onComplete       — callback fired when the unified flow finishes
 *                      successfully so the parent page can refetch data.
 */
const UnifiedSyncButton = ({ dateFrom, dateTo, onComplete, size = 'sm', force = false }) => {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(null);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/lead-analytics/unified-sync/status`);
      return res.data;
    } catch (_) {
      return null;
    }
  }, []);

  // On mount: see if a unified sync is already in progress (e.g. user came
  // back to the page after refresh).
  useEffect(() => {
    let cancelled = false;
    fetchStatus().then(s => {
      if (cancelled || !s) return;
      setStatus(s);
      if (s.status === 'running') {
        setRunning(true);
        startPolling(s.unified_id);
      }
    });
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = (unifiedIdHint) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await fetchStatus();
      if (!s) return;
      setStatus(s);
      if (s.status !== 'running') {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setRunning(false);
        if (s.status === 'completed') {
          toast.success(`Полная синхронизация завершена · ${s.leadsProcessed || 0} лидов + ${s.eventsProcessed || 0} событий`);
          onComplete?.();
        } else if (s.status === 'error') {
          toast.error('Полная синхронизация остановлена: ' + (s.error || 'ошибка'));
        }
      }
    }, 3000);
  };

  const handleStart = async () => {
    setRunning(true);
    try {
      const params = { force };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await axios.post(`${API_URL}/api/lead-analytics/unified-sync`, null, { params });
      toast.success('Полная синхронизация запущена');
      startPolling(res.data.unified_id);
    } catch (e) {
      setRunning(false);
      toast.error('Не удалось запустить: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleCancel = async () => {
    try {
      await axios.post(`${API_URL}/api/lead-analytics/unified-sync/cancel`);
      toast.success('Полная синхронизация отменена');
      setRunning(false);
      const s = await fetchStatus();
      setStatus(s);
      if (pollRef.current) clearInterval(pollRef.current);
    } catch (e) {
      toast.error('Не удалось отменить: ' + (e.response?.data?.detail || e.message));
    }
  };

  // Banner visible only while running OR when there's a recent terminal state
  const isError = status?.status === 'error';
  const isCompleted = status?.status === 'completed';
  const showBanner = running || (isError || isCompleted);

  return (
    <div className="flex flex-col gap-1" data-testid="unified-sync-wrapper">
      <Button
        onClick={running ? handleCancel : handleStart}
        size={size}
        variant={running ? 'outline' : 'default'}
        className={running ? 'border-amber-400 text-amber-700 hover:bg-amber-50' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 text-white'}
        data-testid="unified-sync-button"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />}
        {running ? 'Отменить полную синхр.' : 'Полная синхронизация'}
      </Button>
      {showBanner && status && (
        <div
          className={`text-[11px] rounded-md px-2 py-1 border ${
            running ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
              : isError ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
          data-testid="unified-sync-banner"
        >
          {running && (
            <>
              <span className="font-semibold">{status.phase === 'leads' ? '1/2' : status.phase === 'events' ? '2/2' : '…'}</span>
              {' · '}{status.progress || 'выполняется…'}
            </>
          )}
          {isCompleted && (
            <>✓ {status.progress || 'готово'}</>
          )}
          {isError && (
            <>⚠ {status.error || 'ошибка'}</>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedSyncButton;
