import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Package, User, Phone, FileText, ChevronDown, ChevronUp, 
  Hash, ExternalLink, DollarSign, MessageSquare, AlertCircle,
  Clock
} from 'lucide-react';
import { DELIVERY_STATUSES, getUnassignedOrders, formatDate } from './constants';

const OrderCard = ({ 
  order, 
  isSelected, 
  isExpanded, 
  onSelect, 
  onToggleExpand, 
  onToggleImportant,
  onUpdateDeliveryStatus,
  onUpdateOrderField
}) => {
  const StatusIcon = DELIVERY_STATUSES[order.deliveryStatus]?.icon || Clock;
  
  return (
    <div
      className={`p-3 border rounded-lg transition-colors ${
        isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(order.id)}
          className="mt-1"
          data-testid={`order-checkbox-${order.id}`}
        />
        <div className="flex-1 min-w-0">
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => onToggleExpand(order.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">
                  {order.fullName || order.customerName}
                </p>
                {order.isImportant && (
                  <Badge variant="destructive" className="h-5 px-1">
                    <AlertCircle className="h-3 w-3" />
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {order.fullAddress || order.address}
              </p>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          
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
          </div>
          
          {/* Important order checkbox */}
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
          
          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3 text-sm">
              {/* Structured amoCRM data */}
              {order.amocrm_id && (
                <div className="bg-purple-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-purple-700">Данные из amoCRM</span>
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
                  
                  {order.notes && (
                    <div className="flex items-start gap-2 text-xs">
                      <MessageSquare className="h-3 w-3 text-purple-500 mt-0.5" />
                      <div>
                        <span className="text-muted-foreground">Комментарий:</span>
                        <p className="mt-1">{order.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {order.phoneNumber && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${order.phoneNumber}`} className="text-blue-600 hover:underline">
                    {order.phoneNumber}
                  </a>
                </p>
              )}
              
              {(order.fullAddress || order.address) && (
                <p className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>{order.fullAddress || order.address}</span>
                </p>
              )}
              
              {order.notes && !order.amocrm_id && (
                <p className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap">{order.notes}</span>
                </p>
              )}
              
              {/* Delivery status and route controls */}
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
                
                {/* Delivery Comment */}
                <Input
                  placeholder="Дата/комментарий доставки"
                  defaultValue={order.deliveryComment || ''}
                  className="h-8 text-xs"
                  onBlur={(e) => {
                    if (e.target.value !== (order.deliveryComment || '')) {
                      onUpdateOrderField(order.id, { deliveryComment: e.target.value });
                    }
                  }}
                />
                
                {order.amocrm_id && (
                  <p className="text-xs text-purple-500 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Синхр. с amoCRM при изменении
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const OrdersList = ({
  orders,
  selectedOrders,
  expandedOrder,
  onSelectOrder,
  onToggleExpand,
  onToggleImportant,
  onUpdateDeliveryStatus,
  onUpdateOrderField,
  loading
}) => {
  const unassignedOrders = getUnassignedOrders(orders);

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
          <Badge variant="secondary">{unassignedOrders.length} заказов</Badge>
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
                onSelect={onSelectOrder}
                onToggleExpand={onToggleExpand}
                onToggleImportant={onToggleImportant}
                onUpdateDeliveryStatus={onUpdateDeliveryStatus}
                onUpdateOrderField={onUpdateOrderField}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrdersList;
export { OrderCard };
