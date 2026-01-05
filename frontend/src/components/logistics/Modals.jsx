import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  X, Plus, User, Trash2, Settings, Warehouse, MapPin, RefreshCw
} from 'lucide-react';

// Create Trip Modal
export const CreateTripModal = ({
  show,
  onClose,
  tripName,
  setTripName,
  tripDriver,
  setTripDriver,
  drivers,
  selectedOrdersCount,
  creating,
  onCreate
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Создать рейс</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label>Название рейса</Label>
            <Input
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="Рейс #1"
            />
          </div>
          
          <div>
            <Label>Водитель</Label>
            <Select value={tripDriver} onValueChange={setTripDriver}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите водителя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Без водителя</SelectItem>
                {drivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Выбрано заказов: {selectedOrdersCount}
          </p>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={onCreate} disabled={creating || !tripName.trim()}>
              {creating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Создать
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Drivers Modal
export const DriversModal = ({
  show,
  onClose,
  drivers,
  newDriverName,
  setNewDriverName,
  onAddDriver,
  onRemoveDriver
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
            Управление водителями
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newDriverName}
              onChange={(e) => setNewDriverName(e.target.value)}
              placeholder="Имя нового водителя"
              onKeyDown={(e) => e.key === 'Enter' && onAddDriver()}
            />
            <Button onClick={onAddDriver} disabled={!newDriverName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {drivers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Нет водителей
              </p>
            ) : (
              drivers.map(driver => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between p-2 border rounded-lg"
                >
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {driver.name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onRemoveDriver(driver.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Modal (Warehouse)
export const SettingsModal = ({
  show,
  onClose,
  warehouseAddress,
  setWarehouseAddress,
  warehouseInputRef,
  saving,
  onSave
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Настройки логистики
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              Адрес склада
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Используется как начальная и конечная точка маршрута
            </p>
            <Input
              ref={warehouseInputRef}
              value={warehouseAddress}
              onChange={(e) => setWarehouseAddress(e.target.value)}
              placeholder="Введите адрес склада"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Create Order Modal
export const CreateOrderModal = ({
  show,
  onClose,
  form,
  setForm,
  addressInputRef,
  creating,
  onCreate
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Новый заказ</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label>ФИО клиента *</Label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm(prev => ({ ...prev, fullName: e.target.value }))}
              placeholder="Иван Иванов"
            />
          </div>
          
          <div>
            <Label>Телефон</Label>
            <Input
              value={form.phoneNumber}
              onChange={(e) => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="+48 123 456 789"
            />
          </div>
          
          <div>
            <Label>Адрес *</Label>
            <Input
              ref={addressInputRef}
              value={form.fullAddress}
              onChange={(e) => setForm(prev => ({ ...prev, fullAddress: e.target.value }))}
              placeholder="Город, улица, дом"
            />
          </div>
          
          <div>
            <Label>Состав заказа</Label>
            <Textarea
              value={form.orderComposition}
              onChange={(e) => setForm(prev => ({ ...prev, orderComposition: e.target.value }))}
              placeholder="Описание заказа..."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button 
              onClick={onCreate} 
              disabled={creating || !form.fullName.trim() || !form.fullAddress.trim()}
            >
              {creating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Создать
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
