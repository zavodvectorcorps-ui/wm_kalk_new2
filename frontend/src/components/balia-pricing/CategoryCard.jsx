import React, { memo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { SortableList } from '../ui/sortable-list';
import { Edit2, Trash2, Plus, Upload } from 'lucide-react';
import { OptionItem } from './OptionItem';

const getFullImageUrl = (url, apiUrl) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `${apiUrl}${url}`;
  return url;
};

export const CategoryCard = memo(({ 
  category, 
  catIndex,
  currencySymbol, 
  canEdit, 
  onEditCategory,
  onDeleteCategory,
  onAddOption,
  onEditOption,
  onDeleteOption,
  onReorderOptions,
  onImageUpload,
  getName,
  txt,
  apiUrl
}) => {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {category.imageUrl && (
            <img 
              src={getFullImageUrl(category.imageUrl, apiUrl)} 
              alt={getName(category)}
              className="w-12 h-12 object-contain rounded"
              loading="lazy"
            />
          )}
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{catIndex + 1}</span>
              {getName(category)}
            </h3>
            <Badge variant="outline" className="text-xs">
              {category.inputType === 'checkbox' ? txt.checkbox : txt.dropdown}
            </Badge>
          </div>
        </div>
        
        {canEdit && (
          <div className="flex gap-2">
            <label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onImageUpload(e, category.id)}
              />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="h-3 w-3" /></span>
              </Button>
            </label>
            <Button variant="outline" size="sm" onClick={onEditCategory}>
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={onDeleteCategory}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      
      <Separator />
      
      {/* Options list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">{txt.options}</h4>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onAddOption}>
              <Plus className="h-3 w-3 mr-1" />
              {txt.addOption}
            </Button>
          )}
        </div>
        
        {category.options?.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{txt.noOptions}</p>
        ) : (
          <SortableList
            items={category.options || []}
            onReorder={onReorderOptions}
            disabled={!canEdit}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            renderItem={(option) => (
              <OptionItem
                key={option.id}
                option={option}
                currencySymbol={currencySymbol}
                canEdit={canEdit}
                onEdit={() => onEditOption(option)}
                onDelete={() => onDeleteOption(option.id)}
                getName={getName}
                apiUrl={apiUrl}
              />
            )}
          />
        )}
      </div>
    </div>
  );
});

CategoryCard.displayName = 'CategoryCard';
