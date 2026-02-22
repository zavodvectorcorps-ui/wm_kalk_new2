import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { Loader2 } from 'lucide-react';
import { ELEMENT_TYPES } from '../../constants';

const UploadAssetDialog = ({
  open,
  onOpenChange,
  uploadForm,
  setUploadForm,
  saunaModels,
  onUpload,
  loading
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Загрузить элемент</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Название</Label>
            <Input
              value={uploadForm.name}
              onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              placeholder="Название элемента"
            />
          </div>
          <div>
            <Label>Тип элемента</Label>
            <Select
              value={uploadForm.type}
              onValueChange={(val) => setUploadForm({ ...uploadForm, type: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ELEMENT_TYPES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.icon} {val.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Модель (опционально)</Label>
            <Select
              value={uploadForm.modelId || 'global'}
              onValueChange={(val) => setUploadForm({ ...uploadForm, modelId: val === 'global' ? null : val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Для всех моделей</SelectItem>
                {saunaModels.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Файл (PNG, SVG, WebP)</Label>
            <Input
              type="file"
              accept=".png,.svg,.webp"
              onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
            />
            {uploadForm.file && (
              <p className="text-xs text-muted-foreground mt-1">
                Выбран: {uploadForm.file.name}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ширина (см)</Label>
              <Input
                type="number"
                value={uploadForm.widthCm}
                onChange={(e) => setUploadForm({ ...uploadForm, widthCm: e.target.value })}
                placeholder="60"
              />
            </div>
            <div>
              <Label>Высота (см)</Label>
              <Input
                type="number"
                value={uploadForm.heightCm}
                onChange={(e) => setUploadForm({ ...uploadForm, heightCm: e.target.value })}
                placeholder="80"
              />
            </div>
          </div>
          
          {/* Fixed height option for benches etc */}
          <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Switch
              id="fixedHeight"
              checked={uploadForm.fixedHeight}
              onCheckedChange={(checked) => setUploadForm({ ...uploadForm, fixedHeight: checked })}
            />
            <div className="flex-1">
              <Label htmlFor="fixedHeight" className="text-sm font-medium cursor-pointer">
                Фиксированная высота
              </Label>
              <p className="text-xs text-muted-foreground">
                Для лавок и элементов, где меняется только ширина
              </p>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Укажите фактические размеры элемента для корректного масштабирования
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={onUpload} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Загрузить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadAssetDialog;
