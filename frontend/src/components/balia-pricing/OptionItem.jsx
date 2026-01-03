import React, { memo } from 'react';
import { Button } from '../ui/button';
import { Edit2, Trash2 } from 'lucide-react';

const getFullImageUrl = (url, apiUrl) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `${apiUrl}${url}`;
  return url;
};

export const OptionItem = memo(({ 
  option, 
  currencySymbol, 
  canEdit, 
  onEdit, 
  onDelete,
  getName,
  apiUrl
}) => {
  return (
    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
      <div className="flex items-center gap-2">
        {option.imageUrl && (
          <img 
            src={getFullImageUrl(option.imageUrl, apiUrl)} 
            alt={getName(option)}
            className="w-8 h-8 object-contain rounded"
            loading="lazy"
          />
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
  );
});

OptionItem.displayName = 'OptionItem';
