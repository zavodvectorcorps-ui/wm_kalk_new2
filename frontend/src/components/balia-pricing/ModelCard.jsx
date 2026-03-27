import React, { memo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Edit2, Trash2, X, CheckCircle, Image as ImageIcon } from 'lucide-react';

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

export const ModelCard = memo(({ 
  model, 
  modelIndex, 
  currencySymbol, 
  canEdit, 
  getName, 
  txt, 
  onEdit, 
  onDelete, 
  onRemoveImage 
}) => {
  // Get available types
  const availableHeaters = model.availableHeaterTypes || ['integrated', 'external'];
  const availableBowls = model.availableBowlTypes || ['fiberglass', 'acrylic'];
  
  // Filter heater variants to only available types
  const displayVariants = model.heaterVariants?.filter(v => availableHeaters.includes(v.type)) || [];
  
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">#{modelIndex + 1}</span>
        {/* Bowl types */}
        {availableBowls.map(bowl => (
          <Badge key={bowl} variant="outline" className="text-xs">
            {bowl === 'acrylic' ? 'Акрил' : 'Стеклопластик'}
          </Badge>
        ))}
        {/* Heater types indicator */}
        {availableHeaters.length === 1 && (
          <Badge variant="secondary" className="text-xs">
            {availableHeaters[0] === 'integrated' ? 'Только встр.' : 'Только внеш.'}
          </Badge>
        )}
      </div>
      {model.imageUrl || model.heaterVariants?.[0]?.imageUrl ? (
        <div className="relative">
          <img 
            src={getFullImageUrl(model.heaterVariants?.[0]?.imageUrl || model.imageUrl)} 
            alt={getName(model)} 
            className="w-full h-32 object-contain rounded bg-gray-50"
            loading="lazy"
          />
          {canEdit && (
            <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-6 w-6" onClick={onRemoveImage}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ) : (
        <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      
      <div>
        <h3 className="font-semibold">{getName(model)}</h3>
        {displayVariants.length > 0 ? (
          <div className="space-y-1 mt-1">
            {displayVariants.map(v => (
              <div key={v.type} className="flex items-center gap-2 text-sm">
                <Badge variant={v.type === 'integrated' ? 'default' : v.type === 'none' ? 'secondary' : v.type === 'electric' ? 'default' : 'outline'} className="text-xs">
                  {v.type === 'integrated' ? 'Встр.' : v.type === 'external' ? 'Внеш.' : v.type === 'electric' ? 'Электр.' : 'Без печи'}
                </Badge>
                <span className="font-bold text-blue-600">{v.price} {currencySymbol}</span>
                {v.imageUrl && <CheckCircle className="h-3 w-3 text-green-500" />}
              </div>
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
        
        {model.hint && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{model.hint}</p>}
        
        {model.specs && (
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-0.5">
            {(model.specs.outerDiameter || model.specs.dimensions) && (
              <p>Размеры: {model.specs.dimensions || `Ø ${model.specs.outerDiameter}`}</p>
            )}
            {model.specs.depth && <p>Глубина: {model.specs.depth}</p>}
            {model.specs.volume && <p>Объём: {model.specs.volume}</p>}
            {model.specs.seats > 0 && <p>Мест: {model.specs.seats}</p>}
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
