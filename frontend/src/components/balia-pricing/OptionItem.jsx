import React, { memo } from 'react';
import { Button } from '../ui/button';
import { Edit2, Trash2 } from 'lucide-react';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

const getFullImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `${API_URL}${url}`;
  return url;
};

export const OptionItem = memo(({ 
  option, 
  currencySymbol, 
  canEdit, 
  getName, 
  onEdit, 
  onDelete 
}) => (
  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
    <div className="flex items-center gap-2">
      {option.imageUrl && (
        <img src={getFullImageUrl(option.imageUrl)} alt={getName(option)} className="w-8 h-8 object-contain rounded" loading="lazy" />
      )}
      <span className="text-sm">{getName(option)}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-blue-600">
        {option.price > 0 ? `+${option.price} ${currencySymbol}` : '-'}
      </span>
      {canEdit && (
        <>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  </div>
));

OptionItem.displayName = 'OptionItem';
