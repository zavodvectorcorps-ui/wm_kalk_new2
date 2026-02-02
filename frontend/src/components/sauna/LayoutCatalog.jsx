import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { LayoutGrid, Check, ChevronDown, ChevronUp, Image as ImageIcon, Users, Maximize2, Home, Flame, DoorOpen, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const LayoutCatalog = ({ 
  selectedSize, 
  selectedLayoutId, 
  onLayoutSelect,
  customLayoutImage,
  customLayoutUploading,
  onUploadCustomImage,
  onRemoveCustomImage,
  lang = 'pl' 
}) => {
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [previewLayout, setPreviewLayout] = useState(null);
  const fileInputRef = useRef(null);

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
    uploadCustom: lang === 'pl' ? 'Wgraj własną planowkę' : 'Загрузить свою планировку',
    customLayout: lang === 'pl' ? 'Własna planowka' : 'Своя планировка',
    uploading: lang === 'pl' ? 'Wgrywanie...' : 'Загрузка...',
    removeCustom: lang === 'pl' ? 'Usuń własną planowkę' : 'Удалить свою планировку',
    orUploadOwn: lang === 'pl' ? 'lub wgraj własną planowkę' : 'или загрузите свою планировку',
  };

  // Handle custom image upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error(lang === 'pl' ? 'Nieprawidłowy format pliku. Dozwolone: JPG, PNG, WEBP, GIF' : 'Неверный формат файла. Разрешены: JPG, PNG, WEBP, GIF');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(lang === 'pl' ? 'Plik jest za duży. Maksymalny rozmiar: 10MB' : 'Файл слишком большой. Максимум: 10MB');
      return;
    }

    try {
      await onUploadCustomImage(file);
      toast.success(lang === 'pl' ? 'Planowka została wgrana!' : 'Планировка загружена!');
    } catch (error) {
      toast.error(lang === 'pl' ? 'Błąd podczas wgrywania pliku' : 'Ошибка при загрузке файла');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
            {customLayoutImage && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Upload className="h-3 w-3 mr-1" />
                {txt.customLayout}
              </Badge>
            )}
            {!customLayoutImage && selectedLayout && (
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
              
              {/* Custom Layout Upload Section */}
              <div className="mb-4 p-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="custom-layout-file-input"
                />
                
                {customLayoutImage ? (
                  // Show uploaded custom image
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={customLayoutImage.preview || (customLayoutImage.url.startsWith('/api') ? `${API_URL}${customLayoutImage.url}` : customLayoutImage.url)}
                        alt={txt.customLayout}
                        className="w-24 h-18 object-cover rounded-lg border-2 border-blue-400"
                      />
                      <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-800">{txt.customLayout}</p>
                      <p className="text-xs text-blue-600">{lang === 'pl' ? 'Ta planowka zostanie użyta w PDF' : 'Эта планировка будет использована в PDF'}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRemoveCustomImage}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      data-testid="remove-custom-layout-btn"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {lang === 'pl' ? 'Usuń' : 'Удалить'}
                    </Button>
                  </div>
                ) : (
                  // Upload button
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={customLayoutUploading}
                      className="border-blue-400 text-blue-700 hover:bg-blue-100"
                      data-testid="upload-custom-layout-btn"
                    >
                      {customLayoutUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {txt.uploading}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {txt.uploadCustom}
                        </>
                      )}
                    </Button>
                    <span className="text-sm text-gray-500">{txt.orUploadOwn}</span>
                  </div>
                )}
              </div>
              
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
          {(selectedLayout || customLayoutImage) && (
            <div className={`mt-4 p-3 rounded-lg border ${customLayoutImage ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}>
              <div className="flex items-start gap-4">
                {customLayoutImage ? (
                  <img 
                    src={customLayoutImage.preview || (customLayoutImage.url.startsWith('/api') ? `${API_URL}${customLayoutImage.url}` : customLayoutImage.url)}
                    alt={txt.customLayout}
                    className="w-24 h-18 object-cover rounded-lg border border-blue-300"
                  />
                ) : selectedLayout?.imageUrl && (
                  <img 
                    src={selectedLayout.imageUrl.startsWith('/api') ? `${API_URL}${selectedLayout.imageUrl}` : selectedLayout.imageUrl}
                    alt={selectedLayout.variantName}
                    className="w-24 h-18 object-cover rounded-lg border border-purple-300"
                  />
                )}
                <div className="flex-1">
                  <h4 className={`font-medium flex items-center gap-2 ${customLayoutImage ? 'text-blue-800' : 'text-purple-800'}`}>
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
          
          {/* Dimensions */}
          {previewLayout && (
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-600">
              {previewLayout.peopleCount && (
                <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                  <Users className="h-4 w-4" /> {previewLayout.peopleCount} {txt.people}
                </span>
              )}
              {previewLayout.terraceSize && (
                <span className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded text-green-700">
                  <Home className="h-4 w-4" /> {txt.terrace}: {previewLayout.terraceSize}
                </span>
              )}
              {previewLayout.relaxRoomSize && (
                <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded text-blue-700">
                  <Maximize2 className="h-4 w-4" /> {txt.relaxRoom}: {previewLayout.relaxRoomSize}
                </span>
              )}
              {previewLayout.steamRoomSize && (
                <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 rounded text-orange-700">
                  <Flame className="h-4 w-4" /> {txt.steamRoom}: {previewLayout.steamRoomSize}
                </span>
              )}
              {previewLayout.entranceSide && (
                <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded text-purple-700">
                  <DoorOpen className="h-4 w-4" /> {txt.entrance}: {previewLayout.entranceSide}
                </span>
              )}
            </div>
          )}
          
          {/* Select Button */}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPreviewLayout(null)}>
              {lang === 'pl' ? 'Zamknij' : 'Закрыть'}
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                const layoutId = previewLayout?._id || previewLayout?.id;
                if (layoutId && selectedSize) {
                  onLayoutSelect(selectedSize, layoutId);
                  setPreviewLayout(null);
                }
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              {lang === 'pl' ? 'Wybierz tę planowkę' : 'Выбрать эту планировку'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LayoutCatalog;
