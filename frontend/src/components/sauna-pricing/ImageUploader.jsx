import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Upload, Link, Loader2, CheckCircle, X, Image as ImageIcon, Crop } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { ImageCropper } from '../ImageCropper';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const ImageUploader = ({ 
  value, 
  onChange, 
  label,
  previewLabel,
  urlPlaceholder = "https://example.com/image.jpg",
  themeColor = "amber",
  aspectRatio = 16 / 9
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState(value?.startsWith('/api/uploads/') ? 'upload' : 'url');
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState(null);
  const fileInputRef = useRef(null);

  const texts = {
    ru: {
      uploadFile: 'Загрузить файл',
      urlInput: 'Ссылка URL',
      dragDrop: 'Перетащите изображение сюда или',
      clickToSelect: 'нажмите для выбора',
      supportedFormats: 'JPG, PNG, GIF, WebP (макс. 10MB)',
      uploading: 'Загрузка...',
      uploaded: 'Загружено!',
      optimized: 'Изображение оптимизировано',
      removeImage: 'Удалить',
      preview: 'Превью',
      crop: 'Кадрировать',
    },
    pl: {
      uploadFile: 'Prześlij plik',
      urlInput: 'Link URL',
      dragDrop: 'Przeciągnij obraz tutaj lub',
      clickToSelect: 'kliknij, aby wybrać',
      supportedFormats: 'JPG, PNG, GIF, WebP (maks. 10MB)',
      uploading: 'Przesyłanie...',
      uploaded: 'Przesłano!',
      optimized: 'Obraz zoptymalizowany',
      removeImage: 'Usuń',
      preview: 'Podgląd',
      crop: 'Kadruj',
    },
  };

  // Detect language from document
  const lang = document.documentElement.lang === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  const handleFileSelect = async (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Nieobsługiwany format pliku. Użyj JPG, PNG, GIF lub WebP.');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Plik jest za duży. Maksymalny rozmiar: 10MB.');
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
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', croppedBlob, 'cropped-image.jpg');

      const response = await axios.post(`${API_URL}/api/upload/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      const imageUrl = response.data.url;
      onChange(imageUrl);
      toast.success(txt.optimized);
      setActiveTab('upload');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Błąd przesyłania pliku');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (imageToEdit && imageToEdit.startsWith('blob:')) {
        URL.revokeObjectURL(imageToEdit);
      }
      setImageToEdit(null);
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

  const isOptimized = value?.startsWith('/api/uploads/');

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            {txt.uploadFile}
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-2">
            <Link className="h-4 w-4" />
            {txt.urlInput}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
              ${uploading ? 'border-gray-300 bg-gray-50' : `border-${themeColor}-300 hover:border-${themeColor}-500 hover:bg-${themeColor}-50`}`}
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
              <div className="space-y-3">
                <Loader2 className={`h-10 w-10 mx-auto animate-spin text-${themeColor}-500`} />
                <div className="text-sm text-muted-foreground">
                  {txt.uploading} {uploadProgress}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
                  <div 
                    className={`bg-${themeColor}-500 h-2 rounded-full transition-all`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className={`h-10 w-10 mx-auto text-${themeColor}-400`} />
                <div>
                  <span className="text-muted-foreground">{txt.dragDrop} </span>
                  <span className={`text-${themeColor}-600 font-medium`}>{txt.clickToSelect}</span>
                </div>
                <p className="text-xs text-muted-foreground">{txt.supportedFormats}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="url" className="mt-3">
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={urlPlaceholder}
          />
        </TabsContent>
      </Tabs>

      {/* Image Preview */}
      {value && (
        <div className="mt-3 relative">
          <Label className="text-xs text-muted-foreground mb-1 block">
            {previewLabel || txt.preview}
            {isOptimized && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                {txt.optimized}
              </span>
            )}
          </Label>
          <div className="relative inline-block">
            <img 
              src={getFullImageUrl(value)} 
              alt="Preview" 
              className="max-h-40 object-cover rounded border bg-muted/50"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
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
          </div>
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

export default ImageUploader;
