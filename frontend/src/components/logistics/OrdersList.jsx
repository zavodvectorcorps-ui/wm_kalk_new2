import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Package, ChevronDown, ChevronUp, MapPin, Phone, FileText,
  Hash, User, ExternalLink, DollarSign, MessageSquare, 
  AlertCircle, CheckCircle, X, Clock, RefreshCw
} from 'lucide-react';
import { DELIVERY_STATUSES, formatDate, formatDateTime } from './constants';

// Single order card component
export const OrderCard = ({ 
  order, 
  isSelected, 
  isExpanded,
  isEditingAddress,
  editingAddressValue,
  editAddressInputRef,
  refreshingOrderId,
  onSelect, 
  onToggleExpand,
  onToggleImportant,
  onStartEditAddress,
  onSaveAddress,
  onCancelEditAddress,
  onEditAddressChange,
  onUpdateDeliveryStatus,
  onUpdateOrderField,
  onRefreshFromAmocrm
}) => {
  const StatusIcon = DELIVERY_STATUSES[order.deliveryStatus]?.icon || Clock;
  const isRefreshing = refreshingOrderId === order.id;
  
  return (
    <div
      className={`p-3 border rounded-lg transition-colors ${
        order.isImportant 
          ? 'bg-orange-50 border-orange-300' 
          : isSelected 
            ? 'bg-blue-50 border-blue-300' 
            : 'hover:bg-muted/50'
      }`}
      data-testid={`order-card-${order.id}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(order.id)}
          className="mt-1"
          data-testid={`order-checkbox-${order.id}`}
        />
        <div className="flex-1 min-w-0">
          {/* Order header */}
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => onToggleExpand(order.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">
                  {order.fullName || order.customerName || 'Без имени'}
                </p>
                {order.isImportant && (
                  <Badge variant="destructive" className="h-5 px-1">
                    <AlertCircle className="h-3 w-3" />
                  </Badge>
                )}
              </div>
              
              {/* Address display/edit */}
              {isEditingAddress ? (
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <Input
                    ref={editAddressInputRef}
                    value={editingAddressValue}
                    onChange={(e) => onEditAddressChange(e.target.value)}
                    placeholder="Введите адрес..."
                    className="h-7 text-sm flex-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onSaveAddress(order.id);
                      } else if (e.key === 'Escape') {
                        onCancelEditAddress();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={(e) => { e.stopPropagation(); onSaveAddress(order.id); }}
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={(e) => { e.stopPropagation(); onCancelEditAddress(); }}
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1 group">
                  <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span 
                    className="text-sm text-muted-foreground truncate cursor-pointer hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); onStartEditAddress(order.id, order.fullAddress || order.address); }}
                    title="Нажмите, чтобы изменить адрес"
                  >
                    {order.fullAddress || order.address || 'Нет адреса — нажмите для добавления'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onStartEditAddress(order.id, order.fullAddress || order.address); }}
                  >
                    <FileText className="h-3 w-3" />
                  </Button>
                  {(order.lat && order.lng) ? (
                    <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 whitespace-nowrap">
                      ✓ на карте
                    </span>
                  ) : (order.fullAddress || order.address) ? (
                    <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 whitespace-nowrap">
                      ⏳ геокодинг
                    </span>
                  ) : (
                    <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300 whitespace-nowrap">
                      нет адреса
                    </span>
                  )}
                </div>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          
          {/* Meta info */}
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            <span>{formatDate(order.orderDate || order.createdAt)}</span>
            {order.routeNumber && (
              <Badge variant="outline" className="text-xs py-0 px-1">
                <Hash className="h-2 w-2 mr-1" />
                Рейс {order.routeNumber}
              </Badge>
            )}
            {order.driverName && (
              <Badge variant="outline" className="text-xs py-0 px-1">
                <User className="h-2 w-2 mr-1" />
                {order.driverName}
              </Badge>
            )}
            {order.amocrm_id && <span className="text-purple-500">• amoCRM</span>}
            {order.transferredAt && (
              <span className="text-green-600" title={`Перенесён: ${formatDateTime(order.transferredAt)}`}>
                • перенесён {formatDateTime(order.transferredAt)}
              </span>
            )}
            {order.updatedAt && (
              <span className="text-blue-500" title={`Обновлено: ${formatDateTime(order.updatedAt)}`}>
                • изм. {formatDateTime(order.updatedAt)}
              </span>
            )}
            {order.changeHistory && order.changeHistory.length > 0 && (
              <Badge variant="outline" className="text-xs py-0 px-1 bg-gray-100 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                <FileText className="h-2 w-2 mr-1" />
                {order.changeHistory.length} изм.
              </Badge>
            )}
          </div>
          
          {/* Important checkbox */}
          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id={`important-${order.id}`}
              checked={order.isImportant || false}
              onCheckedChange={() => onToggleImportant(order.id)}
              className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
            />
            <label 
              htmlFor={`important-${order.id}`}
              className={`text-xs cursor-pointer flex items-center gap-1 ${order.isImportant ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}
            >
              <AlertCircle className={`h-3 w-3 ${order.isImportant ? 'text-red-500' : ''}`} />
              Важный заказ
            </label>
          </div>
          
          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3 text-sm">
              {/* Editable fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Client name */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Имя клиента
                  </label>
                  <Input
                    defaultValue={order.clientName || order.fullName || ''}
                    placeholder="Введите имя клиента"
                    className="h-8 text-sm"
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue !== (order.clientName || order.fullName || '')) {
                        onUpdateOrderField(order.id, { clientName: newValue, fullName: newValue });
                      }
                    }}
                  />
                </div>
                
                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Телефон
                  </label>
                  <Input
                    defaultValue={order.phoneNumber || order.phone || ''}
                    placeholder="Введите телефон"
                    className="h-8 text-sm"
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue !== (order.phoneNumber || order.phone || '')) {
                        onUpdateOrderField(order.id, { phoneNumber: newValue, phone: newValue });
                      }
                    }}
                  />
                </div>
              </div>
              
              {/* Order contents - full width */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Состав заказа
                </label>
                <textarea
                  defaultValue={order.orderContents || order.notes || ''}
                  placeholder="Введите состав заказа"
                  className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    if (newValue !== (order.orderContents || order.notes || '')) {
                      onUpdateOrderField(order.id, { orderContents: newValue, notes: newValue });
                    }
                  }}
                />
              </div>
              
              {/* Financial fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Сумма заказа
                  </label>
                  <Input
                    defaultValue={order.dealSum || order.totalPrice || ''}
                    placeholder="0"
                    className="h-8 text-sm"
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (newValue !== (order.dealSum || order.totalPrice || '')) {
                        onUpdateOrderField(order.id, { dealSum: newValue, totalPrice: newValue });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1 text-red-600">
                    <DollarSign className="h-3 w-3" />
                    Задолженность
                  </label>
                  {/* Check for OPŁACONE tag */}
                  {(order.amocrm_tags?.some(t => (t.name || t) === 'OPŁACONE' || (t.name || t) === 'OPLACONE')) ? (
                    <div className="h-8 flex items-center px-2 bg-green-100 border border-green-300 rounded text-green-700 text-sm font-medium">
                      ✓ Оплачен на Allegro
                    </div>
                  ) : (
                    <Input
                      defaultValue={order.debtSum || order.amountDue || ''}
                      placeholder="0"
                      className="h-8 text-sm border-red-200 focus:ring-red-500"
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        if (newValue !== (order.debtSum || order.amountDue || '')) {
                          onUpdateOrderField(order.id, { debtSum: newValue, amountDue: newValue });
                        }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* amoCRM Tags */}
              {order.amocrm_tags && order.amocrm_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {order.amocrm_tags.map((tag, idx) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded-full">
                      {tag.name || tag}
                    </span>
                  ))}
                </div>
              )}

              {/* amoCRM data */}
              {order.amocrm_id && (
                <div className="bg-purple-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-purple-700">Данные из amoCRM</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRefreshFromAmocrm && onRefreshFromAmocrm(order.id, order.amocrm_id);
                        }}
                        disabled={isRefreshing}
                        data-testid={`refresh-order-${order.id}`}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Обновление...' : 'Обновить'}
                      </Button>
                      {order.amocrm_link && (
                        <a
                          href={order.amocrm_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Открыть в amoCRM
                        </a>
                      )}
                    </div>
                  </div>
                  {order.order_number && (
                    <div className="flex items-center gap-2 text-xs">
                      <Hash className="h-3 w-3 text-purple-500" />
                      <span className="text-muted-foreground">Номер сделки:</span>
                      <span className="font-medium">{order.order_number}</span>
                    </div>
                  )}
                  {order.budget && (
                    <div className="flex items-center gap-2 text-xs">
                      <DollarSign className="h-3 w-3 text-purple-500" />
                      <span className="text-muted-foreground">Бюджет:</span>
                      <span className="font-medium">{order.budget} PLN</span>
                    </div>
                  )}
                  {order.transferredAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-purple-500" />
                      <span className="text-muted-foreground">Перенесён:</span>
                      <span className="font-medium">{formatDate(order.transferredAt)}</span>
                    </div>
                  )}
                  {order.updatedFromAmo && (
                    <div className="flex items-center gap-2 text-xs">
                      <RefreshCw className="h-3 w-3 text-purple-500" />
                      <span className="text-muted-foreground">Обновлено из amoCRM:</span>
                      <span className="font-medium">{formatDateTime(order.updatedFromAmo)}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Transfer info for non-amoCRM orders */}
              {!order.amocrm_id && order.transferredAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Создан: {formatDate(order.transferredAt || order.createdAt)}</span>
                </div>
              )}
              
              {/* Change history */}
              {order.changeHistory && order.changeHistory.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 mt-2">
                  <details>
                    <summary className="text-xs font-medium text-gray-600 cursor-pointer flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      История изменений ({order.changeHistory.length})
                    </summary>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                      {order.changeHistory.slice().reverse().map((entry, idx) => (
                        <div key={idx} className="text-xs border-l-2 border-gray-300 pl-2">
                          <div className="text-gray-500">{formatDateTime(entry.timestamp)}</div>
                          {entry.changes?.map((change, cIdx) => (
                            <div key={cIdx} className="text-gray-700">
                              <span className="font-medium">{change.field}</span>: {' '}
                              <span className="text-red-500 line-through">{change.oldValue || '—'}</span>
                              {' → '}
                              <span className="text-green-600">{change.newValue || '—'}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
              
              {/* Last updated */}
              {order.updatedAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  <span>Обновлено: {formatDateTime(order.updatedAt)}</span>
                </div>
              )}
              
              {/* Delivery status controls */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Статус доставки:</span>
                </div>
                <Select
                  value={order.deliveryStatus || 'pending'}
                  onValueChange={(value) => onUpdateDeliveryStatus(order.id, value)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DELIVERY_STATUSES).map(([key, val]) => {
                      const Icon = val.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-3 w-3" />
                            {val.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                <Input
                  placeholder="Комментарий к доставке"
                  defaultValue={order.deliveryComment || ''}
                  className="h-8 text-xs"
                  onBlur={(e) => {
                    if (e.target.value !== (order.deliveryComment || '')) {
                      onUpdateOrderField(order.id, { deliveryComment: e.target.value });
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Orders list component
const OrdersList = ({
  orders,
  selectedOrders,
  expandedOrder,
  editingAddressOrderId,
  editingAddressValue,
  editAddressInputRef,
  loading,
  refreshingOrderId,
  onSelectOrder,
  onToggleExpand,
  onToggleImportant,
  onStartEditAddress,
  onSaveAddress,
  onCancelEditAddress,
  onEditAddressChange,
  onUpdateDeliveryStatus,
  onUpdateOrderField,
  onRefreshFromAmocrm
}) => {
  // Filter to show only orders without trip
  const unassignedOrders = (orders || []).filter(o => !o.tripId);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Заказы (без рейса)
          </span>
          <Badge variant="secondary">{unassignedOrders.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {unassignedOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет свободных заказов</p>
            <p className="text-sm">Все заказы распределены по рейсам</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {unassignedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isSelected={selectedOrders.includes(order.id)}
                isExpanded={expandedOrder === order.id}
                isEditingAddress={editingAddressOrderId === order.id}
                editingAddressValue={editingAddressValue}
                editAddressInputRef={editAddressInputRef}
                refreshingOrderId={refreshingOrderId}
                onSelect={onSelectOrder}
                onToggleExpand={onToggleExpand}
                onToggleImportant={onToggleImportant}
                onStartEditAddress={onStartEditAddress}
                onSaveAddress={onSaveAddress}
                onCancelEditAddress={onCancelEditAddress}
                onEditAddressChange={onEditAddressChange}
                onUpdateDeliveryStatus={onUpdateDeliveryStatus}
                onUpdateOrderField={onUpdateOrderField}
                onRefreshFromAmocrm={onRefreshFromAmocrm}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrdersList;
