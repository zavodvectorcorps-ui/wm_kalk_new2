import React, { memo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Edit2, Trash2 } from 'lucide-react';

const getFullImageUrl = (url, apiUrl) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `${apiUrl}${url}`;
  return url;
};

export const ModelCard = memo(({ 
  model, 
  currencySymbol, 
  canEdit, 
  onEdit, 
  onDelete, 
  getName,
  txt,
  apiUrl
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="w-full sm:w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        {model.imageUrl ? (
          <img 
            src={getFullImageUrl(model.imageUrl, apiUrl)} 
            alt={getName(model)}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">🛁</span>
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 space-y-2">
        <h3 className="font-semibold text-lg">{getName(model)}</h3>
        
        {model.heaterVariants?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {model.heaterVariants.map((variant, idx) => (
              <Badge key={idx} variant="outline" className="text-sm">
                {variant.type === 'integrated' ? txt.integrated : txt.external}: {variant.price} {currencySymbol}
              </Badge>
            ))}
          </div>
        ) : (
          <>
            <p className="text-lg font-bold text-blue-600">{model.basePrice} {currencySymbol}</p>
            <Badge variant="outline" className="mt-1">
              {model.heaterType === 'external' ? txt.external : txt.integrated}
            </Badge>
          </>
        )}
        
        {model.hint && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{model.hint}</p>
        )}
        
        {model.specs && (
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-0.5">
            {(model.specs.outerDiameter || model.specs.dimensions) && (
              <p>📐 {model.specs.dimensions || `Ø ${model.specs.outerDiameter}`}</p>
            )}
            {model.specs.depth && <p>📏 Глубина: {model.specs.depth}</p>}
            {model.specs.volume && <p>💧 Объём: {model.specs.volume}</p>}
            {model.specs.seats > 0 && <p>👥 Мест: {model.specs.seats}</p>}
          </div>
        )}
      </div>
      
      {canEdit && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit2 className="h-3 w-3 mr-1" />
            Редактировать
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
});

ModelCard.displayName = 'ModelCard';
