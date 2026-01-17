import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { 
  FileText, 
  Image as ImageIcon, 
  Palette, 
  Type, 
  Layout, 
  Save, 
  Plus, 
  Trash2, 
  Upload,
  Eye,
  EyeOff,
  GripVertical,
  Check,
  X,
  RefreshCw,
  FileSearch,
  Copy,
  Star,
  Download,
  FileUp
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Block names in Polish
const BLOCK_NAMES = {
  header: 'Nagłówek z logo',
  client_info: 'Dane klienta',
  model_photo: 'Model i zdjęcie',
  options: 'Opcje',
  promo: 'Blok promocyjny',
  benches: 'Informacje o ławkach',
  total: 'Podsumowanie',
  gallery: 'Galeria',
  footer: 'Stopka'
};

export const PDFTemplateEditor = ({ calculatorType = 'sauna' }) => {
  const { isAdmin } = useAuth();
  const [template, setTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState([]);
  const [activeTab, setActiveTab] = useState('blocks');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);

  // Fetch templates and images on mount
  useEffect(() => {
    fetchTemplates();
    fetchImages();
  }, [calculatorType]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/pdf-templates?calculator_type=${calculatorType}`);
      const allTemplates = response.data;
      setTemplates(allTemplates);
      
      // Select default template or first one
      const defaultTemplate = allTemplates.find(t => t.isDefault) || allTemplates[0];
      if (defaultTemplate) {
        setTemplate(defaultTemplate);
      } else {
        // Load default structure if no templates exist
        const defaultResponse = await axios.get(`${API_URL}/api/pdf-templates/default/${calculatorType}`);
        setTemplate(defaultResponse.data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Błąd ładowania szablonów');
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/pdf-templates/images?calculator_type=${calculatorType}`);
      setImages(response.data);
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  const handleSave = async () => {
    if (!template) return;
    
    try {
      setSaving(true);
      
      if (template.id) {
        // Update existing template
        await axios.put(`${API_URL}/api/pdf-templates/${template.id}`, {
          blocks: template.blocks,
          colors: template.colors,
          texts: template.texts,
          logoImageId: template.logoImageId,
          promoImageId: template.promoImageId,
          galleryImageIds: template.galleryImageIds
        });
      } else {
        // Create new template
        const response = await axios.post(`${API_URL}/api/pdf-templates`, {
          name: `Szablon ${calculatorType.toUpperCase()}`,
          calculator_type: calculatorType,
          isDefault: true,
          blocks: template.blocks,
          colors: template.colors,
          texts: template.texts,
          logoImageId: template.logoImageId,
          promoImageId: template.promoImageId,
          galleryImageIds: template.galleryImageIds
        });
        setTemplate(response.data);
      }
      
      toast.success('Szablon zapisany!');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Błąd zapisywania szablonu');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      
      // First save the template to ensure preview uses latest changes
      if (template) {
        if (template.id) {
          await axios.put(`${API_URL}/api/pdf-templates/${template.id}`, {
            blocks: template.blocks,
            colors: template.colors,
            texts: template.texts,
            logoImageId: template.logoImageId,
            promoImageId: template.promoImageId,
            galleryImageIds: template.galleryImageIds
          });
        } else {
          const response = await axios.post(`${API_URL}/api/pdf-templates`, {
            name: `Szablon ${calculatorType.toUpperCase()}`,
            calculator_type: calculatorType,
            isDefault: true,
            blocks: template.blocks,
            colors: template.colors,
            texts: template.texts,
            logoImageId: template.logoImageId,
            promoImageId: template.promoImageId,
            galleryImageIds: template.galleryImageIds
          });
          setTemplate(response.data);
        }
      }
      
      // Generate preview PDF
      const response = await axios.post(
        `${API_URL}/api/pdf-templates/preview/${calculatorType}`,
        {},
        { responseType: 'blob' }
      );
      
      // Create blob URL for the PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Revoke old URL if exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setPreviewUrl(url);
      setPreviewOpen(true);
      
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Błąd generowania podglądu');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSelectTemplate = (selectedTemplate) => {
    setTemplate(selectedTemplate);
  };

  const handleDuplicateTemplate = async () => {
    if (!template?.id) {
      toast.error('Najpierw zapisz bieżący szablon');
      return;
    }
    
    try {
      setDuplicating(true);
      const response = await axios.post(
        `${API_URL}/api/pdf-templates/${template.id}/duplicate`,
        null,
        { params: { new_name: newTemplateName || undefined } }
      );
      
      // Refresh templates list
      await fetchTemplates();
      
      // Select the new template
      setTemplate(response.data);
      setShowNewTemplateDialog(false);
      setNewTemplateName('');
      
      toast.success('Szablon zduplikowany!');
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Błąd duplikowania szablonu');
    } finally {
      setDuplicating(false);
    }
  };

  const handleSetDefault = async (templateId) => {
    try {
      await axios.put(`${API_URL}/api/pdf-templates/${templateId}`, {
        isDefault: true
      });
      
      // Refresh templates
      await fetchTemplates();
      toast.success('Ustawiono jako domyślny');
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('Błąd ustawiania domyślnego');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten szablon?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/pdf-templates/${templateId}`);
      
      // If deleted template was selected, switch to default
      if (template?.id === templateId) {
        const remaining = templates.filter(t => t.id !== templateId);
        const defaultTpl = remaining.find(t => t.isDefault) || remaining[0];
        setTemplate(defaultTpl || null);
      }
      
      // Refresh templates
      await fetchTemplates();
      toast.success('Szablon usunięty');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Błąd usuwania szablonu');
    }
  };

  const handleCreateNewTemplate = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/pdf-templates`, {
        name: newTemplateName || `Nowy szablon`,
        calculator_type: calculatorType,
        isDefault: false,
        blocks: template?.blocks || [],
        colors: template?.colors || {},
        texts: template?.texts || {},
        logoImageId: null,
        promoImageId: null,
        galleryImageIds: []
      });
      
      await fetchTemplates();
      setTemplate(response.data);
      setShowNewTemplateDialog(false);
      setNewTemplateName('');
      
      toast.success('Nowy szablon utworzony!');
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Błąd tworzenia szablonu');
    }
  };

  const handleBlockToggle = (blockId) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => 
        block.id === blockId ? { ...block, enabled: !block.enabled } : block
      )
    }));
  };

  const handleColorChange = (colorKey, value) => {
    setTemplate(prev => ({
      ...prev,
      colors: { ...prev.colors, [colorKey]: value }
    }));
  };

  const handleTextChange = (textKey, value) => {
    setTemplate(prev => ({
      ...prev,
      texts: { ...prev.texts, [textKey]: value }
    }));
  };

  const handleImageUpload = async (e, imageType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${API_URL}/api/pdf-templates/images/upload?image_type=${imageType}&calculator_type=${calculatorType}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      // Update template with new image
      if (imageType === 'logo') {
        setTemplate(prev => ({ ...prev, logoImageId: response.data.id }));
      } else if (imageType === 'promo') {
        setTemplate(prev => ({ ...prev, promoImageId: response.data.id }));
      } else if (imageType === 'gallery') {
        setTemplate(prev => ({
          ...prev,
          galleryImageIds: [...(prev.galleryImageIds || []), response.data.id]
        }));
      }
      
      fetchImages();
      toast.success('Zdjęcie przesłane!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Błąd przesyłania zdjęcia');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveGalleryImage = (imageId) => {
    setTemplate(prev => ({
      ...prev,
      galleryImageIds: prev.galleryImageIds.filter(id => id !== imageId)
    }));
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await axios.delete(`${API_URL}/api/pdf-templates/images/${imageId}`);
      
      // Remove from template if used
      setTemplate(prev => ({
        ...prev,
        logoImageId: prev.logoImageId === imageId ? null : prev.logoImageId,
        promoImageId: prev.promoImageId === imageId ? null : prev.promoImageId,
        galleryImageIds: prev.galleryImageIds?.filter(id => id !== imageId) || []
      }));
      
      fetchImages();
      toast.success('Zdjęcie usunięte');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Błąd usuwania zdjęcia');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await axios.post(`${API_URL}/api/pdf-templates/seed-defaults`);
      fetchTemplates();
      toast.success('Domyślny szablon utworzony');
    } catch (error) {
      console.error('Error seeding defaults:', error);
      toast.error('Błąd tworzenia szablonu');
    }
  };

  if (!isAdmin || !isAdmin()) {
    return <div className="p-4 text-center text-muted-foreground">Доступ запрещён</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Konstruktor PDF</h2>
          <p className="text-muted-foreground">
            Настройка шаблона PDF для {calculatorType === 'sauna' ? 'саун' : 'купелей'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!template?.id && (
            <Button variant="outline" onClick={handleSeedDefaults}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Создать шаблон
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowNewTemplateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nowy szablon
          </Button>
          {template?.id && (
            <Button variant="outline" onClick={() => {
              setNewTemplateName(`${template.name || 'Szablon'} (kopia)`);
              setShowNewTemplateDialog(true);
            }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplikuj
            </Button>
          )}
          <Button variant="outline" onClick={handlePreview} disabled={previewLoading}>
            <FileSearch className="h-4 w-4 mr-2" />
            {previewLoading ? 'Генерация...' : 'Предпросмотр'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Podgląd PDF
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-0 overflow-hidden">
            {previewUrl && (
              <object
                data={previewUrl}
                type="application/pdf"
                className="w-full h-[calc(90vh-140px)] border rounded-lg"
              >
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                  <FileText className="h-16 w-16" />
                  <p>Twoja przeglądarka nie obsługuje podglądu PDF.</p>
                  <Button asChild>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      Otwórz w nowej karcie
                    </a>
                  </Button>
                </div>
              </object>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Zamknij
            </Button>
            {previewUrl && (
              <>
                <Button variant="outline" asChild>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    Otwórz w nowej karcie
                  </a>
                </Button>
                <Button asChild>
                  <a href={previewUrl} download="preview.pdf">
                    Pobierz PDF
                  </a>
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New/Duplicate Template Dialog */}
      <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newTemplateName.includes('kopia') ? 'Duplikuj szablon' : 'Nowy szablon'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa szablonu</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="np. Promocja zimowa, Standard, VIP..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNewTemplateDialog(false);
              setNewTemplateName('');
            }}>
              Anuluj
            </Button>
            <Button 
              onClick={newTemplateName.includes('kopia') ? handleDuplicateTemplate : handleCreateNewTemplate}
              disabled={duplicating}
            >
              {duplicating ? 'Tworzenie...' : (newTemplateName.includes('kopia') ? 'Duplikuj' : 'Utwórz')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selector */}
      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Wybierz szablon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    template?.id === tpl.id 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleSelectTemplate(tpl)}
                >
                  <span className="font-medium">{tpl.name}</span>
                  {tpl.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Domyślny
                    </Badge>
                  )}
                  {template?.id === tpl.id && !tpl.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(tpl.id);
                      }}
                    >
                      Ustaw domyślny
                    </Button>
                  )}
                  {template?.id === tpl.id && !tpl.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(tpl.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="blocks" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Блоки
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Изображения
          </TabsTrigger>
          <TabsTrigger value="texts" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Тексты
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Цвета
          </TabsTrigger>
        </TabsList>

        {/* Blocks Tab */}
        <TabsContent value="blocks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Блоки PDF</CardTitle>
              <CardDescription>
                Включайте или выключайте секции в PDF. Порядок блоков фиксирован.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {template?.blocks?.map((block, index) => (
                  <div 
                    key={block.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{BLOCK_NAMES[block.id] || block.name}</span>
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {block.enabled ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Switch
                        checked={block.enabled}
                        onCheckedChange={() => handleBlockToggle(block.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-4">
          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle>Логотип</CardTitle>
              <CardDescription>Логотип в шапке PDF</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {template?.logoImageId ? (
                  <div className="relative">
                    <img 
                      src={`${API_URL}/api/pdf-templates/images/${template.logoImageId}/data`}
                      alt="Logo"
                      className="h-16 object-contain border rounded"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => setTemplate(prev => ({ ...prev, logoImageId: null }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-16 w-32 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                    Нет логотипа
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'logo')}
                    disabled={uploadingImage}
                  />
                  <Button variant="outline" asChild disabled={uploadingImage}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Загрузить
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Promo Image */}
          <Card>
            <CardHeader>
              <CardTitle>Промо-изображение</CardTitle>
              <CardDescription>Изображение для блока подарка/промо</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {template?.promoImageId ? (
                  <div className="relative">
                    <img 
                      src={`${API_URL}/api/pdf-templates/images/${template.promoImageId}/data`}
                      alt="Promo"
                      className="h-24 object-contain border rounded"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => setTemplate(prev => ({ ...prev, promoImageId: null }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-24 w-32 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                    Нет изображения
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'promo')}
                    disabled={uploadingImage}
                  />
                  <Button variant="outline" asChild disabled={uploadingImage}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Загрузить
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Gallery Images */}
          <Card>
            <CardHeader>
              <CardTitle>Галерея</CardTitle>
              <CardDescription>Фотографии для страницы галереи (до 6 шт.)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {template?.galleryImageIds?.map((imageId) => (
                  <div key={imageId} className="relative">
                    <img 
                      src={`${API_URL}/api/pdf-templates/images/${imageId}/data`}
                      alt="Gallery"
                      className="w-full h-24 object-cover border rounded"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => handleRemoveGalleryImage(imageId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {(template?.galleryImageIds?.length || 0) < 6 && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'gallery')}
                      disabled={uploadingImage}
                    />
                    <div className="w-full h-24 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors">
                      <Plus className="h-6 w-6" />
                    </div>
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* All uploaded images */}
          <Card>
            <CardHeader>
              <CardTitle>Все загруженные изображения</CardTitle>
              <CardDescription>Управление загруженными файлами</CardDescription>
            </CardHeader>
            <CardContent>
              {images.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Нет загруженных изображений</p>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {images.map((img) => (
                    <div key={img.id} className="relative group">
                      <img 
                        src={`${API_URL}/api/pdf-templates/images/${img.id}/data`}
                        alt={img.filename}
                        className="w-full h-20 object-cover border rounded"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteImage(img.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Badge className="absolute bottom-1 left-1 text-xs" variant="secondary">
                        {img.image_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Texts Tab */}
        <TabsContent value="texts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Редактирование текстов</CardTitle>
              <CardDescription>Настройте тексты, которые отображаются в PDF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Заголовок документа</Label>
                <Input
                  value={template?.texts?.headerTitle || ''}
                  onChange={(e) => handleTextChange('headerTitle', e.target.value)}
                  placeholder="OFERTA HANDLOWA"
                />
              </div>
              
              <div>
                <Label>Заголовок промо-блока</Label>
                <Input
                  value={template?.texts?.promoTitle || ''}
                  onChange={(e) => handleTextChange('promoTitle', e.target.value)}
                  placeholder="PROMOCJA"
                />
              </div>
              
              <div>
                <Label>Текст промо-блока (HTML)</Label>
                <Textarea
                  value={template?.texts?.promoText || ''}
                  onChange={(e) => handleTextChange('promoText', e.target.value)}
                  placeholder="Darmowa balia do schłodzenia..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Можно использовать &lt;br/&gt; для переноса строки
                </p>
              </div>
              
              <div>
                <Label>Текст гарантии</Label>
                <Input
                  value={template?.texts?.warrantyText || ''}
                  onChange={(e) => handleTextChange('warrantyText', e.target.value)}
                  placeholder="GWARANCJA: 12 miesiące..."
                />
              </div>
              
              <div>
                <Label>Текст футера</Label>
                <Input
                  value={template?.texts?.footerText || ''}
                  onChange={(e) => handleTextChange('footerText', e.target.value)}
                  placeholder="Oferta ważna 30 dni..."
                />
              </div>
              
              <div>
                <Label>Заголовок галереи</Label>
                <Input
                  value={template?.texts?.galleryTitle || ''}
                  onChange={(e) => handleTextChange('galleryTitle', e.target.value)}
                  placeholder="GALERIA REALIZACJI"
                />
              </div>
              
              <div>
                <Label>Слоган компании</Label>
                <Input
                  value={template?.texts?.companySlogan || ''}
                  onChange={(e) => handleTextChange('companySlogan', e.target.value)}
                  placeholder="WM-Group — Producent saun..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Цветовая схема</CardTitle>
              <CardDescription>Настройте цвета PDF документа</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Основной цвет</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={template?.colors?.primary || '#8B4513'}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={template?.colors?.primary || '#8B4513'}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Вторичный цвет</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={template?.colors?.secondary || '#D2B48C'}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={template?.colors?.secondary || '#D2B48C'}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Акцентный цвет</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={template?.colors?.accent || '#CD853F'}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={template?.colors?.accent || '#CD853F'}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Цвет текста</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={template?.colors?.text || '#333333'}
                      onChange={(e) => handleColorChange('text', e.target.value)}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={template?.colors?.text || '#333333'}
                      onChange={(e) => handleColorChange('text', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Приглушённый цвет</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={template?.colors?.muted || '#666666'}
                      onChange={(e) => handleColorChange('muted', e.target.value)}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={template?.colors?.muted || '#666666'}
                      onChange={(e) => handleColorChange('muted', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
              
              {/* Preview */}
              <div className="mt-6 p-4 border rounded-lg">
                <h4 className="font-medium mb-3">Предпросмотр цветов:</h4>
                <div className="flex gap-2">
                  <div 
                    className="w-16 h-16 rounded flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: template?.colors?.primary || '#8B4513' }}
                  >
                    Primary
                  </div>
                  <div 
                    className="w-16 h-16 rounded flex items-center justify-center text-xs"
                    style={{ backgroundColor: template?.colors?.secondary || '#D2B48C' }}
                  >
                    Secondary
                  </div>
                  <div 
                    className="w-16 h-16 rounded flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: template?.colors?.accent || '#CD853F' }}
                  >
                    Accent
                  </div>
                  <div 
                    className="w-16 h-16 rounded border flex items-center justify-center text-xs"
                    style={{ color: template?.colors?.text || '#333333' }}
                  >
                    Text
                  </div>
                  <div 
                    className="w-16 h-16 rounded border flex items-center justify-center text-xs"
                    style={{ color: template?.colors?.muted || '#666666' }}
                  >
                    Muted
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PDFTemplateEditor;
