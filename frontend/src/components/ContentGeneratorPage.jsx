import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { 
  Upload, Loader2, Image as ImageIcon, Trash2, Download, 
  RefreshCw, CheckCircle, XCircle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

import { getApiUrl } from '../utils/api';
const API_URL = getApiUrl();

const ContentGeneratorPage = () => {
  const [prompt, setPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [processedImages, setProcessedImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // Load default prompt and processed images on mount
  useEffect(() => {
    fetchDefaultPrompt();
    fetchProcessedImages();
  }, []);

  const fetchDefaultPrompt = async () => {
    try {
      const res = await fetch(`${API_URL}/api/content/default-prompt`);
      if (res.ok) {
        const data = await res.json();
        setDefaultPrompt(data.prompt);
        setPrompt(data.prompt);
      }
    } catch (error) {
      console.error('Error fetching default prompt:', error);
    }
  };

  const fetchProcessedImages = async () => {
    setLoadingImages(true);
    try {
      const res = await fetch(`${API_URL}/api/content/processed-images`);
      if (res.ok) {
        const data = await res.json();
        setProcessedImages(data.images || []);
      }
    } catch (error) {
      console.error('Error fetching processed images:', error);
    }
    setLoadingImages(false);
  };

  // Poll job status
  useEffect(() => {
    if (!jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/content/job/${jobId}`);
        if (res.ok) {
          const status = await res.json();
          setJobStatus(status);

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setProcessing(false);
            setJobId(null);
            toast.success(`Обработка завершена! ${status.results.filter(r => r.success).length} из ${status.total_images} изображений обработано`);
            fetchProcessedImages();
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).slice(0, 10);
    setSelectedFiles(files);

    // Create preview URLs
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const removeFile = (index) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);

    const newUrls = [...previewUrls];
    URL.revokeObjectURL(newUrls[index]);
    newUrls.splice(index, 1);
    setPreviewUrls(newUrls);
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Выберите хотя бы одно изображение');
      return;
    }

    setProcessing(true);
    setJobStatus(null);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('prompt', prompt);

    try {
      const res = await fetch(`${API_URL}/api/content/process-batch`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setJobId(data.job_id);
        toast.info(`Начата обработка ${data.total_images} изображений...`);
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка при запуске обработки');
        setProcessing(false);
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
      setProcessing(false);
    }
  };

  const handleDeleteImage = async (filename) => {
    if (!window.confirm('Удалить это изображение?')) return;

    try {
      const res = await fetch(`${API_URL}/api/content/images/${filename}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Изображение удалено');
        fetchProcessedImages();
      }
    } catch (error) {
      toast.error('Ошибка при удалении');
    }
  };

  const handleDownloadImage = async (url, filename) => {
    try {
      // URL from Cloudinary is already absolute, no need to prepend API_URL
      const imageUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Create blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Ошибка при скачивании');
    }
  };

  const resetPrompt = () => {
    setPrompt(defaultPrompt);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-600" />
          Создать контент
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Upload and Settings */}
        <div className="space-y-4">
          {/* Prompt Editor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Промпт для обработки
                <Button variant="outline" size="sm" onClick={resetPrompt}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Сбросить
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Введите промпт для обработки изображений..."
                rows={8}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Этот текст будет отправлен AI для обработки каждой фотографии
              </p>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Загрузить фотографии</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    disabled={processing}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Нажмите или перетащите файлы сюда
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Максимум 10 изображений (JPEG, PNG, WebP)
                    </p>
                  </label>
                </div>

                {/* Selected files preview */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Выбрано: {selectedFiles.length} файлов</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-16 object-cover rounded border"
                          />
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Process button */}
                <Button
                  onClick={handleProcess}
                  disabled={processing || selectedFiles.length === 0}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Обработать {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Job Status */}
          {jobStatus && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Статус обработки</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Прогресс:</span>
                    <span className="font-medium">
                      {jobStatus.processed_images} / {jobStatus.total_images}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${(jobStatus.processed_images / jobStatus.total_images) * 100}%` }}
                    />
                  </div>
                  
                  {/* Results */}
                  {jobStatus.results.length > 0 && (
                    <div className="space-y-1 mt-4">
                      {jobStatus.results.map((result, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          {result.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="truncate">{result.original_filename}</span>
                          {result.success && (
                            <a
                              href={result.url.startsWith('http') ? result.url : `${API_URL}${result.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:underline ml-auto"
                            >
                              Открыть
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Processed Images Gallery */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Обработанные изображения ({processedImages.length})
              </span>
              <Button variant="outline" size="sm" onClick={fetchProcessedImages} disabled={loadingImages}>
                <RefreshCw className={`h-3 w-3 mr-1 ${loadingImages ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {processedImages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Нет обработанных изображений</p>
                <p className="text-xs mt-1">Загрузите фотографии саун для обработки</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                {processedImages.map((image) => (
                  <div key={image.filename} className="group relative">
                    <img
                      src={image.url.startsWith('http') ? image.url : `${API_URL}${image.url}`}
                      alt={image.filename}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadImage(image.url, image.filename)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteImage(image.filename)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {image.filename}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContentGeneratorPage;
