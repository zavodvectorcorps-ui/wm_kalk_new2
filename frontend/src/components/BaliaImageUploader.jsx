import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Upload, Link, Loader2, CheckCircle, X, Image as ImageIcon, Crop } from 'lucide-react';
import { toast } from 'sonner';
import { ImageCropper } from './ImageCropper';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const BaliaImageUploader = ({ 
  value, 
  onChange, 
  label,
  previewLabel,
  urlPlaceholder = "https://example.com/image.jpg",
  compact = false,
  aspectRatio = 4 / 3  // Default 4:3 for Balia models
}) => {
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState(value?.includes('/api/uploads/') ? 'upload' : 'url');
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState(null);
  const fileInputRef = useRef(null);

  const texts = {
    ru: {
      uploadFile: 'Загрузить',
      urlInput: 'URL',
      dragDrop: 'Перетащите изображение или',
      clickToSelect: 'нажмите для выбора',
      supportedFormats: 'JPG, PNG, GIF, WebP (до 10MB)',
      uploading: 'Загрузка...',
      uploaded: 'Загружено!',
      optimized: 'Оптимизировано',
      removeImage: 'Удалить',
      preview: 'Превью',
      crop: 'Кадрировать',
    },
    pl: {
      uploadFile: 'Prześlij',
      urlInput: 'URL',
      dragDrop: 'Przeciągnij obraz lub',
      clickToSelect: 'kliknij, aby wybrać',
      supportedFormats: 'JPG, PNG, GIF, WebP (do 10MB)',
      uploading: 'Przesyłanie...',
      uploaded: 'Przesłano!',
      optimized: 'Zoptymalizowano',
      removeImage: 'Usuń',
      preview: 'Podgląd',
      crop: 'Kadruj',
    },
  };

  const lang = document.documentElement.lang === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  const handleFileSelect = async (file) => {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Nieobsługiwany format. Użyj JPG, PNG, GIF lub WebP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Plik za duży. Max 10MB.');
      return;
    }

    // Create object URL for cropping
    const objectUrl = URL.createObjectURL(file);
    setImageToEdit(objectUrl);
    setCropperOpen(true);
  };

  const handleCropComplete = async (croppedBlob) => {
    setCropperOpen(false);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', croppedBlob, 'cropped-image.jpg');

      console.log('Uploading to:', `${API_URL}/api/upload/image`);
      
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Upload successful, URL:', data.url);
      
      // Verify the URL is valid
      if (!data.url || !data.url.startsWith('/api/uploads/')) {
        console.error('Invalid URL returned:', data.url);
        throw new Error('Invalid URL returned from server');
      }
      
      onChange(data.url);
      toast.success(txt.optimized);
      setActiveTab('upload');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Błąd przesyłania: ${error.message}`);
    } finally {
      setUploading(false);
      if (imageToEdit) {
        URL.revokeObjectURL(imageToEdit);
        setImageToEdit(null);
      }
    }
  };

  const handleEditExisting = () => {
    if (value) {
      setImageToEdit(getFullImageUrl(value));
      setCropperOpen(true);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleRemoveImage = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFullImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/api/')) return `${API_URL}${url}`;
    return url;
  };

  const isOptimized = value?.includes('/api/uploads/');

  if (compact) {
    return (
      <div className="space-y-2">
        {label && <Label className="text-sm">{label}</Label>}
        <div className="flex items-center gap-2">
          {value ? (
            <div className="relative">
              <img 
                src={getFullImageUrl(value)} 
                alt="Preview" 
                className="w-16 h-16 object-cover rounded border bg-gray-50"
                onError={(e) => e.target.style.display = 'none'}
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-1 -right-1 h-5 w-5 p-0"
                onClick={handleRemoveImage}
              >
                <X className="h-3 w-3" />
              </Button>
              {isOptimized && (
                <CheckCircle className="absolute -bottom-1 -left-1 h-4 w-4 text-green-500 bg-white rounded-full" />
              )}
            </div>
          ) : (
            <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                disabled={uploading}
              />
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                <span className="cursor-pointer">
                  {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                  {txt.uploadFile}
                </span>
              </Button>
            </label>
            <Input
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="URL"
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Cropper Dialog */}
        <ImageCropper
          open={cropperOpen}
          onClose={() => setCropperOpen(false)}
          imageSrc={imageToEdit}
          onCropComplete={handleCropComplete}
          aspectRatio={aspectRatio}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {label && <Label>{label}</Label>}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="upload" className="gap-1 text-xs">
            <Upload className="h-3 w-3" />
            {txt.uploadFile}
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-1 text-xs">
            <Link className="h-3 w-3" />
            {txt.urlInput}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-2">
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
              ${uploading ? 'border-gray-300 bg-gray-50' : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              disabled={uploading}
            />
            
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-500" />
                <p className="text-sm text-muted-foreground">{txt.uploading}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-blue-400" />
                <p className="text-sm">
                  <span className="text-muted-foreground">{txt.dragDrop} </span>
                  <span className="text-blue-600 font-medium">{txt.clickToSelect}</span>
                </p>
                <p className="text-xs text-muted-foreground">{txt.supportedFormats}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="url" className="mt-2">
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={urlPlaceholder}
          />
        </TabsContent>
      </Tabs>

      {value && (
        <div className="relative inline-block">
          <img 
            src={getFullImageUrl(value)} 
            alt="Preview" 
            className="max-h-32 object-cover rounded border bg-gray-50"
            onError={(e) => e.target.style.display = 'none'}
          />
          <div className="absolute top-1 right-1 flex gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleEditExisting}
              title={txt.crop}
            >
              <Crop className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleRemoveImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isOptimized && (
            <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded">
              <CheckCircle className="h-3 w-3" />
              {txt.optimized}
            </span>
          )}
        </div>
      )}

      {/* Cropper Dialog */}
      <ImageCropper
        open={cropperOpen}
        onClose={() => {
          setCropperOpen(false);
          if (imageToEdit && imageToEdit.startsWith('blob:')) {
            URL.revokeObjectURL(imageToEdit);
          }
          setImageToEdit(null);
        }}
        imageSrc={imageToEdit}
        onCropComplete={handleCropComplete}
        aspectRatio={aspectRatio}
      />
    </div>
  );
};

export default BaliaImageUploader;
