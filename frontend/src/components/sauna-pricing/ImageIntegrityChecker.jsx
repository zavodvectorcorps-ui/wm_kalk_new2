import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '../ui/dialog';
import { ScanSearch, Loader2, ImageOff, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const o = window.location.origin;
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o;
  }
  return process.env.REACT_APP_BACKEND_URL || '';
};
const API_URL = getApiUrl();

const GroupedList = ({ items }) => {
  const groups = items.reduce((acc, it) => {
    const key = `${it.calculator} · ${it.section}`;
    (acc[key] = acc[key] || []).push(it);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([group, list]) => (
        <div key={group}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{group}</div>
          <div className="space-y-1.5">
            {list.map((it, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 p-2 text-sm"
                data-testid="broken-image-row"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.item}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.field} · <span className="text-red-600">{it.reason}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{it.url}</div>
                </div>
                <a
                  href={it.url.startsWith('/') ? `${API_URL}${it.url}` : it.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-amber-700 hover:text-amber-900"
                  title="Открыть ссылку"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const ImageIntegrityChecker = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showUncertain, setShowUncertain] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.get(`${API_URL}/api/sauna/check-images?scope=all`);
      setResult(res.data);
    } catch (e) {
      setError('Не удалось выполнить проверку. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (v) => {
    setOpen(v);
    if (v && !result && !loading) runCheck();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="check-images-btn">
          <ScanSearch className="h-4 w-4 mr-2" />
          Найти битые изображения
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageOff className="h-5 w-5 text-amber-600" />
            Проверка изображений
          </DialogTitle>
          <DialogDescription>
            Сканируем все картинки моделей, вариантов и опций (Сауны + Бали) и проверяем их доступность.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3" data-testid="check-images-loading">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            <span className="text-sm">Проверяем ссылки…</span>
          </div>
        )}

        {error && !loading && (
          <div className="py-6 text-center text-sm text-red-600">{error}</div>
        )}

        {result && !loading && (
          <div className="space-y-4" data-testid="check-images-result">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">Всего: {result.total_images}</Badge>
              <Badge variant={result.broken_count ? 'destructive' : 'outline'} data-testid="broken-count-badge">
                Битых: {result.broken_count}
              </Badge>
              {result.uncertain_count > 0 && (
                <Badge variant="secondary">Не проверено: {result.uncertain_count}</Badge>
              )}
              <Button variant="ghost" size="sm" onClick={runCheck} className="ml-auto">
                <ScanSearch className="h-4 w-4 mr-1" /> Проверить снова
              </Button>
            </div>

            {result.broken_count === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                Битых изображений не найдено 🎉
              </div>
            ) : (
              <GroupedList items={result.broken} />
            )}

            {result.uncertain_count > 0 && (
              <div className="pt-2 border-t">
                <button
                  onClick={() => setShowUncertain((s) => !s)}
                  className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900"
                  data-testid="toggle-uncertain-btn"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Не удалось проверить ({result.uncertain_count}) — хост блокирует автоматическую проверку, в браузере обычно открываются
                  <span className="text-xs">{showUncertain ? '▲' : '▼'}</span>
                </button>
                {showUncertain && (
                  <div className="mt-3">
                    <GroupedList items={result.uncertain} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImageIntegrityChecker;
