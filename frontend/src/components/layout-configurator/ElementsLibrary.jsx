import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import { ELEMENT_TYPES } from './constants';

export const ElementsLibrary = ({
  assets,
  layouts,
  activeTab,
  setActiveTab,
  addElementToCanvas,
  handleDeleteAsset,
  handleLoadLayout,
  handleDuplicateLayout,
  handlePublishLayout,
  handleDeleteLayout,
  setUploadAssetDialogOpen,
  API_URL,
}) => {
  // Group assets by type
  const assetsByType = assets.reduce((acc, asset) => {
    if (!acc[asset.type]) acc[asset.type] = [];
    acc[asset.type].push(asset);
    return acc;
  }, {});

  return (
    <Card className="flex-1 flex flex-col overflow-hidden min-h-[400px]">
      <CardHeader className="py-3 px-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Элементы</CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={() => setUploadAssetDialogOpen(true)}
            data-testid="add-element-button"
          >
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 mb-3 h-9">
            <TabsTrigger value="elements" className="text-sm" data-testid="elements-tab">Библиотека</TabsTrigger>
            <TabsTrigger value="layouts" className="text-sm" data-testid="layouts-tab">Планировки</TabsTrigger>
          </TabsList>
          
          <TabsContent value="elements" className="mt-0">
            {Object.entries(assetsByType).map(([type, typeAssets]) => (
              <div key={type} className="mb-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  <span className="text-lg">{ELEMENT_TYPES[type]?.icon}</span>
                  <span>{ELEMENT_TYPES[type]?.name || type}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {typeAssets.map(asset => (
                    <div
                      key={asset.id}
                      className="group relative aspect-square bg-muted rounded-lg border-2 cursor-pointer hover:border-primary hover:shadow-md transition-all"
                      onClick={() => addElementToCanvas(asset)}
                      title={`Нажмите чтобы добавить: ${asset.name}`}
                      data-testid={`asset-${asset.id}`}
                    >
                      <img
                        src={asset.imageUrl.startsWith('http') ? asset.imageUrl : `${API_URL}${asset.imageUrl}`}
                        alt={asset.name}
                        className="w-full h-full object-contain p-2"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg truncate">
                        {asset.name}
                      </div>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAsset(asset.id);
                        }}
                        data-testid={`delete-asset-${asset.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {assets.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>Нет загруженных элементов</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setUploadAssetDialogOpen(true)}
                >
                  Загрузить первый элемент
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="layouts" className="mt-0">
            <div className="space-y-2">
              {layouts.map(layout => (
                <div
                  key={layout.id}
                  className="p-2 border rounded hover:bg-muted/50 cursor-pointer group"
                  onClick={() => handleLoadLayout(layout)}
                  data-testid={`layout-${layout.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{layout.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Дублировать"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateLayout(layout);
                        }}
                        data-testid={`duplicate-layout-${layout.id}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title={layout.isPublished ? 'Скрыть' : 'Опубликовать'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePublishLayout(layout);
                        }}
                        data-testid={`publish-layout-${layout.id}`}
                      >
                        {layout.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        title="Удалить"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLayout(layout.id);
                        }}
                        data-testid={`delete-layout-${layout.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {layout.modelName}
                    {layout.isPublished && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Опубликовано
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              
              {layouts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>Нет сохраненных планировок</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ElementsLibrary;
