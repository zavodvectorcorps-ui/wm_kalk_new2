import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Check, X, ZoomIn, ZoomOut, RotateCw, Maximize2, Square, RectangleHorizontal, RectangleVertical } from 'lucide-react';

// Helper function to create cropped image
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });

const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  const rotRad = (rotation * Math.PI) / 180;

  // Calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  // Set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate canvas center to the center of the bounding box
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Draw rotated image
  ctx.drawImage(image, 0, 0);

  // Extract the cropped image using another canvas
  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) return null;

  // Set the size of the cropped canvas
  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  // Draw the cropped image
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Return as blob
  return new Promise((resolve) => {
    croppedCanvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      'image/jpeg',
      0.92
    );
  });
};

function rotateSize(width, height, rotation) {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

// Predefined aspect ratios
const ASPECT_RATIOS = {
  '4:3': { value: 4 / 3, label: '4:3', icon: RectangleHorizontal },
  '16:9': { value: 16 / 9, label: '16:9', icon: RectangleHorizontal },
  '1:1': { value: 1, label: '1:1', icon: Square },
  '3:4': { value: 3 / 4, label: '3:4', icon: RectangleVertical },
  'free': { value: undefined, label: 'Свободное', icon: Maximize2 },
};

export const ImageCropper = ({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio: initialAspectRatio = 4 / 3,
  title = 'Kadrowanie obrazu',
  showAspectSelector = true,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);

  const texts = {
    ru: {
      title: 'Кадрирование изображения',
      zoom: 'Масштаб',
      rotation: 'Поворот',
      apply: 'Применить',
      cancel: 'Отмена',
      reset: 'Сброс',
      processing: 'Обработка...',
      aspectRatio: 'Пропорции',
      free: 'Свободное',
      zoomIn: 'Увеличить',
      zoomOut: 'Уменьшить',
      fitImage: 'Вместить всё',
    },
    pl: {
      title: 'Kadrowanie obrazu',
      zoom: 'Powiększenie',
      rotation: 'Obrót',
      apply: 'Zastosuj',
      cancel: 'Anuluj',
      reset: 'Reset',
      processing: 'Przetwarzanie...',
      aspectRatio: 'Proporcje',
      free: 'Dowolne',
      zoomIn: 'Powiększ',
      zoomOut: 'Pomniejsz',
      fitImage: 'Dopasuj całość',
    },
  };

  const lang = document.documentElement.lang === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  const onCropChange = useCallback((location) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom) => {
    setZoom(newZoom);
  }, []);

  const onCropCompleteHandler = useCallback((croppedArea, croppedAreaPx) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels || !imageSrc) return;

    setProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      if (croppedBlob) {
        onCropComplete(croppedBlob);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleFitImage = () => {
    setZoom(0.5); // Zoom out to fit more of the image
    setCrop({ x: 0, y: 0 });
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5" />
            {txt.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aspect Ratio Selector */}
          {showAspectSelector && (
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm">{txt.aspectRatio}:</Label>
              <div className="flex gap-1">
                {Object.entries(ASPECT_RATIOS).map(([key, { value, label, icon: Icon }]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={aspectRatio === value ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setAspectRatio(value)}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Cropper Area */}
          <div className="relative w-full h-72 bg-gray-900 rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              minZoom={0.3}
              maxZoom={4}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteHandler}
              showGrid={true}
              objectFit="contain"
              style={{
                containerStyle: {
                  borderRadius: '0.5rem',
                },
              }}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <ZoomIn className="h-4 w-4" />
                  {txt.zoom}: {zoom.toFixed(2)}x
                </Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setZoom(Math.min(4, zoom + 0.1))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={handleFitImage}
                    title={txt.fitImage}
                  >
                    {txt.fitImage}
                  </Button>
                </div>
              </div>
              <Slider
                value={[zoom]}
                min={0.3}
                max={4}
                step={0.05}
                onValueChange={([value]) => setZoom(value)}
              />
            </div>

            {/* Rotation Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <RotateCw className="h-4 w-4" />
                  {txt.rotation}: {rotation}°
                </Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  >
                    -90°
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                  >
                    +90°
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={handleReset}
                  >
                    {txt.reset}
                  </Button>
                </div>
              </div>
              <Slider
                value={[rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={([value]) => setRotation(value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={processing}>
            <X className="h-4 w-4 mr-1" />
            {txt.cancel}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={processing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {processing ? (
              <>
                <span className="animate-spin mr-1">⏳</span>
                {txt.processing}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                {txt.apply}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;
