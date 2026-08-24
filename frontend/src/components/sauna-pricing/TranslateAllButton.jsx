import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Languages, Loader2 } from 'lucide-react';

export const TranslateAllButton = ({ onTranslate }) => {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (loading) return;
    if (!window.confirm('Перевести названия ВСЕХ опций на русский через ИИ? Существующие русские названия будут перезаписаны.')) return;
    setLoading(true);
    try {
      await onTranslate();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={loading} data-testid="translate-all-btn">
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Languages className="h-4 w-4 mr-2" />}
      {loading ? 'Перевод…' : 'Авто-перевод RU'}
    </Button>
  );
};

export default TranslateAllButton;
