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
import { Check, X, ZoomIn, RotateCw, Maximize2 } from 'lucide-react';

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
      0.95
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

export const ImageCropper = ({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 4 / 3,
  title = 'Kadrowanie obrazu',
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const texts = {
    ru: {
      title: 'Кадрирование изображения',
      zoom: 'Масштаб',
      rotation: 'Поворот',
      apply: 'Применить',
      cancel: 'Отмена',
      reset: 'Сброс',
      processing: 'Обработка...',
      aspectRatio: 'Соотношение сторон',
      free: 'Свободное',
      square: 'Квадрат',
      landscape: '4:3',
      portrait: '3:4',
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
      square: 'Kwadrat',
      landscape: '4:3',
      portrait: '3:4',
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

  if (!imageSrc) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5" />
            {txt.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cropper Area */}
          <div className="relative w-full h-80 bg-gray-900 rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteHandler}
              showGrid={true}
              style={{
                containerStyle: {
                  borderRadius: '0.5rem',
                },
              }}
            />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-4">
            {/* Zoom Control */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <ZoomIn className="h-4 w-4" />
                {txt.zoom}: {zoom.toFixed(1)}x
              </Label>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={([value]) => setZoom(value)}
              />
            </div>

            {/* Rotation Control */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <RotateCw className="h-4 w-4" />
                {txt.rotation}: {rotation}°
              </Label>
              <Slider
                value={[rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={([value]) => setRotation(value)}
              />
            </div>
          </div>

          {/* Quick Rotation Buttons */}
          <div className="flex gap-2 justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="h-4 w-4 mr-1" />
              +90°
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              {txt.reset}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
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
