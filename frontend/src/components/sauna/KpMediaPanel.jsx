import React, { useRef, useState } from 'react';
import axios from 'axios';
import { API_URL, getImageUrl } from './constants';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Upload, X, Loader2, Image as ImageIcon, Images } from 'lucide-react';

const uploadFile = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await axios.post(`${API_URL}/api/upload/image`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.url;
};

export const KpMediaPanel = ({
  customModelImageUrl,
  galleryImages = [],
  setCustomModelImage,
  addGalleryImage,
  updateGalleryComment,
  removeGalleryImage,
}) => {
  const modelInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const MAX_GALLERY = 6;

  const handleModelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingModel(true);
    try {
      const url = await uploadFile(file);
      if (url) setCustomModelImage(url);
    } finally {
      setUploadingModel(false);
      if (modelInputRef.current) modelInputRef.current.value = '';
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingGallery(true);
    try {
      const room = MAX_GALLERY - galleryImages.length;
      for (const file of files.slice(0, room)) {
        const url = await uploadFile(file);
        if (url) addGalleryImage(url);
      }
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-5" data-testid="kp-media-panel">
      <div className="flex items-center gap-2 text-amber-800">
        <ImageIcon className="h-5 w-5" />
        <h3 className="font-semibold text-base">Медиа для КП</h3>
      </div>

      {/* Custom model photo */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">Своё фото модели (заменяет фото по умолчанию в КП)</div>
        <input ref={modelInputRef} type="file" accept="image/*" className="hidden" onChange={handleModelUpload} data-testid="kp-model-photo-input" />
        {customModelImageUrl ? (
          <div className="relative inline-block">
            <img src={getImageUrl(customModelImageUrl)} alt="custom model" className="h-28 w-40 object-cover rounded-lg border" data-testid="kp-model-photo-preview" />
            <button
              onClick={() => setCustomModelImage('')}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
              data-testid="kp-model-photo-remove"
              title="Удалить"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => modelInputRef.current?.click()} disabled={uploadingModel} data-testid="kp-model-photo-btn">
            {uploadingModel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Загрузить фото модели
          </Button>
        )}
      </div>

      {/* Client gallery */}
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Images className="h-4 w-4" />
          Галерея для клиента ({galleryImages.length}/{MAX_GALLERY}) — с комментариями
        </div>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} data-testid="kp-gallery-input" />
        {galleryImages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {galleryImages.map((g, idx) => (
              <div key={idx} className="rounded-lg border bg-white p-2 space-y-2" data-testid={`kp-gallery-item-${idx}`}>
                <div className="relative">
                  <img src={getImageUrl(g.url)} alt={`gallery-${idx}`} className="h-32 w-full object-cover rounded" />
                  <button
                    onClick={() => removeGalleryImage(idx)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
                    data-testid={`kp-gallery-remove-${idx}`}
                    title="Удалить"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  value={g.comment || ''}
                  onChange={(e) => updateGalleryComment(idx, e.target.value)}
                  placeholder="Комментарий к фото (необязательно)"
                  className="text-sm"
                  data-testid={`kp-gallery-comment-${idx}`}
                />
              </div>
            ))}
          </div>
        )}
        {galleryImages.length < MAX_GALLERY && (
          <Button variant="outline" size="sm" onClick={() => galleryInputRef.current?.click()} disabled={uploadingGallery} data-testid="kp-gallery-btn">
            {uploadingGallery ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Добавить фото в галерею
          </Button>
        )}
      </div>
    </div>
  );
};

export default KpMediaPanel;
