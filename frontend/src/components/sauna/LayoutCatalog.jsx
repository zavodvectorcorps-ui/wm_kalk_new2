import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { LayoutGrid, Check, ChevronDown, ChevronUp, Image as ImageIcon, Users, Maximize2, Home, Flame, DoorOpen } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const LayoutCatalog = ({ 
  selectedSize, 
  selectedLayoutId, 
  onLayoutSelect, 
  lang = 'pl' 
}) => {
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [previewLayout, setPreviewLayout] = useState(null);

  // Group layouts by model size
  const groupedLayouts = layouts.reduce((acc, layout) => {
    const size = layout.modelSize || 'Inne';
    if (!acc[size]) acc[size] = [];
    acc[size].push(layout);
    return acc;
  }, {});

  // Available sizes
  const availableSizes = Object.keys(groupedLayouts).sort();

  // Layouts for selected size
  const layoutsForSize = selectedSize ? (groupedLayouts[selectedSize] || []) : [];

  // Selected layout object
  const selectedLayout = layouts.find(l => l._id === selectedLayoutId || l.id === selectedLayoutId);

  // Load layouts
  useEffect(() => {
    const fetchLayouts = async () => {
      try {
        const response = await fetch(`${API_URL}/api/faq/layout-variants`);
        if (response.ok) {
          const data = await response.json();
          setLayouts(data);
        }
      } catch (error) {
        console.error('Failed to load layout variants:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLayouts();
  }, []);

  const txt = {
    title: lang === 'pl' ? 'Katalog planowek' : 'Каталог планировок',
    selectSize: lang === 'pl' ? 'Wybierz rozmiar' : 'Выберите размер',
    selectLayout: lang === 'pl' ? 'Wybierz planowkę' : 'Выберите планировку',
    selected: lang === 'pl' ? 'Wybrana' : 'Выбрано',
    noImage: lang === 'pl' ? 'Brak zdjęcia' : 'Нет фото',
    showCatalog: lang === 'pl' ? 'Pokaż katalog planowek' : 'Показать каталог планировок',
    hideCatalog: lang === 'pl' ? 'Ukryj katalog' : 'Скрыть каталог',
    people: lang === 'pl' ? 'osób' : 'чел.',
    terrace: lang === 'pl' ? 'Taras' : 'Терраса',
    relaxRoom: lang === 'pl' ? 'Pokój wyp.' : 'Комната отдыха',
    steamRoom: lang === 'pl' ? 'Sauna' : 'Парная',
    entrance: lang === 'pl' ? 'Wejście' : 'Вход',
  };

  if (loading) {
    return null;
  }

  if (layouts.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-md border-2 border-purple-200">
      <CardHeader 
        className="bg-gradient-to-r from-purple-50 to-pink-50 cursor-pointer py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <CardTitle className="flex items-center justify-between text-purple-800">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            <span className="text-base">{txt.title}</span>
            {selectedLayout && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <Check className="h-3 w-3 mr-1" />
                {selectedLayout.variantName}
              </Badge>
            )}
          </div>
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4 space-y-4">
          {/* Size Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              {txt.selectSize}
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map(size => (
                <Button
                  key={size}
                  variant={selectedSize === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onLayoutSelect(size, null)}
                  className={selectedSize === size ? 'bg-purple-600 hover:bg-purple-700' : ''}
                >
                  {size}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {groupedLayouts[size].length}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Layout Cards for Selected Size */}
          {selectedSize && layoutsForSize.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                {txt.selectLayout}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {layoutsForSize.map(layout => {
                  const layoutId = layout._id || layout.id;
                  const isSelected = layoutId === selectedLayoutId;
                  
                  return (
                    <div
                      key={layoutId}
                      className={`
                        relative rounded-xl border-2 overflow-hidden transition-all
                        ${isSelected 
                          ? 'border-purple-500 ring-2 ring-purple-300 shadow-lg' 
                          : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                        }
                      `}
                    >
                      {/* Image - click to preview */}
                      <div 
                        className="aspect-[4/3] bg-gray-100 relative cursor-pointer"
                        onClick={() => setPreviewLayout(layout)}
                      >
                        {layout.imageUrl ? (
                          <img 
                            src={layout.imageUrl.startsWith('/api') ? `${API_URL}${layout.imageUrl}` : layout.imageUrl}
                            alt={layout.variantName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}
                        
                        {/* Selected Badge */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                        
                        {/* Zoom hint */}
                        <div className="absolute bottom-1 right-1 bg-black/50 text-white rounded px-1 py-0.5 text-[10px]">
                          🔍
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-2">
                        <h4 className="font-medium text-sm text-gray-800 truncate">
                          {layout.variantName}
                        </h4>
                        
                        {/* Dimensions badges */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {layout.peopleCount && (
                            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                              <Users className="h-2.5 w-2.5 mr-0.5" />
                              {layout.peopleCount}
                            </span>
                          )}
                          {layout.steamRoomSize && (
                            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 bg-orange-100 rounded text-orange-600">
                              <Flame className="h-2.5 w-2.5 mr-0.5" />
                              {layout.steamRoomSize}
                            </span>
                          )}
                          {layout.entranceSide && (
                            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 bg-blue-100 rounded text-blue-600">
                              <DoorOpen className="h-2.5 w-2.5 mr-0.5" />
                              {layout.entranceSide}
                            </span>
                          )}
                        </div>
                        
                        {/* Select Button */}
                        <Button
                          size="sm"
                          className={`w-full mt-2 ${
                            isSelected 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                          onClick={() => onLayoutSelect(selectedSize, layoutId)}
                        >
                          {isSelected ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              {lang === 'pl' ? 'Wybrana' : 'Выбрано'}
                            </>
                          ) : (
                            lang === 'pl' ? 'Wybierz' : 'Выбрать'
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Layout Preview */}
          {selectedLayout && (
            <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-start gap-4">
                {selectedLayout.imageUrl && (
                  <img 
                    src={selectedLayout.imageUrl.startsWith('/api') ? `${API_URL}${selectedLayout.imageUrl}` : selectedLayout.imageUrl}
                    alt={selectedLayout.variantName}
                    className="w-24 h-18 object-cover rounded-lg border border-purple-300"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-medium text-purple-800 flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    {txt.selected}: {selectedLayout.variantName}
                  </h4>
                  {selectedLayout.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {selectedLayout.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-600">
                    {selectedLayout.peopleCount && (
                      <span><Users className="h-3 w-3 inline mr-1" />{selectedLayout.peopleCount} {txt.people}</span>
                    )}
                    {selectedLayout.terraceSize && (
                      <span><Home className="h-3 w-3 inline mr-1" />{txt.terrace}: {selectedLayout.terraceSize}</span>
                    )}
                    {selectedLayout.relaxRoomSize && (
                      <span><Maximize2 className="h-3 w-3 inline mr-1" />{txt.relaxRoom}: {selectedLayout.relaxRoomSize}</span>
                    )}
                    {selectedLayout.steamRoomSize && (
                      <span><Flame className="h-3 w-3 inline mr-1" />{txt.steamRoom}: {selectedLayout.steamRoomSize}</span>
                    )}
                    {selectedLayout.entranceSide && (
                      <span><DoorOpen className="h-3 w-3 inline mr-1" />{txt.entrance}: {selectedLayout.entranceSide}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewLayout} onOpenChange={() => setPreviewLayout(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewLayout?.variantName}</DialogTitle>
          </DialogHeader>
          {previewLayout?.imageUrl && (
            <img 
              src={previewLayout.imageUrl.startsWith('/api') ? `${API_URL}${previewLayout.imageUrl}` : previewLayout.imageUrl}
              alt={previewLayout.variantName}
              className="w-full rounded-lg"
            />
          )}
          {previewLayout?.description && (
            <p className="text-sm text-gray-600 mt-2">{previewLayout.description}</p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LayoutCatalog;
