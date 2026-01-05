import React from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Route, User, Trash2, Sparkles, GripVertical, ArrowUp, ArrowDown,
  RefreshCw, Navigation, MapPin, Phone, Warehouse
} from 'lucide-react';
import { TRIP_STATUSES, ORDER_TRIP_STATUSES, mapContainerStyle, formatDistance, formatDuration } from './constants';

const TripDetails = ({
  selectedTrip,
  orders,
  drivers,
  isLoaded,
  warehouseCoords,
  tripDirections,
  tripRouteInfo,
  buildingTripRoute,
  optimizingRoute,
  draggedOrderIndex,
  onTripMapLoad,
  onUpdateTrip,
  onDeleteTrip,
  onOptimizeRoute,
  onBuildTripRoute,
  onUpdateOrderStatus,
  onRemoveOrderFromTrip,
  onMoveOrderInTrip,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}) => {
  if (!selectedTrip) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Выберите рейс</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Route className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Выберите рейс из списка слева</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tripOrders = selectedTrip.orderIds
    ?.map(id => orders.find(o => o.id === id))
    .filter(Boolean) || [];

  const StatusIcon = TRIP_STATUSES[selectedTrip.status || 'planned']?.icon || Route;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{selectedTrip.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={TRIP_STATUSES[selectedTrip.status || 'planned']?.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {TRIP_STATUSES[selectedTrip.status || 'planned']?.label}
              </Badge>
              {selectedTrip.driverName && (
                <Badge variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  {selectedTrip.driverName}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={onOptimizeRoute}
              disabled={optimizingRoute || tripOrders.length < 1}
              title="Оптимизировать маршрут"
            >
              {optimizingRoute ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onDeleteTrip}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Trip controls */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Select
            value={selectedTrip.driverId || ''}
            onValueChange={(value) => {
              const driver = drivers.find(d => d.id === value);
              onUpdateTrip(selectedTrip.id, { 
                driverId: value || null, 
                driverName: driver?.name || null 
              });
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Водитель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Без водителя</SelectItem>
              {drivers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select
            value={selectedTrip.status || 'planned'}
            onValueChange={(value) => onUpdateTrip(selectedTrip.id, { status: value })}
          >
            <SelectTrigger className="h-8 text-sm" data-testid="trip-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRIP_STATUSES).map(([key, val]) => {
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
        </div>
        
        {/* Route info */}
        {tripRouteInfo && (
          <div className="flex gap-4 text-sm mt-2 bg-muted rounded-lg p-2">
            <span className="flex items-center gap-1">
              <Navigation className="h-4 w-4 text-blue-600" />
              {formatDistance(tripRouteInfo.distance)}
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4 text-green-600" />
              {formatDuration(tripRouteInfo.duration)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs ml-auto"
              onClick={onBuildTripRoute}
              disabled={buildingTripRoute}
            >
              {buildingTripRoute ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Navigation className="h-3 w-3 mr-1" />
              )}
              Обновить
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {tripOrders.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>Нет заказов в рейсе</p>
          </div>
        ) : (
          tripOrders.map((order, index) => {
            const orderStatus = selectedTrip.orderStatuses?.[order.id] || 'pending';
            return (
              <div 
                key={order.id}
                className={`p-2 border rounded-lg text-sm ${
                  draggedOrderIndex === index ? 'opacity-50 bg-muted' : ''
                }`}
                draggable
                onDragStart={() => onDragStart(index)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => onDragOver(e, index)}
                onDrop={(e) => onDrop(e, index)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => onMoveOrderInTrip(-1, index)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => onMoveOrderInTrip(1, index)}
                      disabled={index === tripOrders.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-5 w-5 p-0 justify-center text-xs">
                        {index + 1}
                      </Badge>
                      <span className="font-medium truncate">
                        {order.fullName || order.customerName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {order.fullAddress || order.address}
                    </p>
                    {order.phoneNumber && (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {order.phoneNumber}
                      </p>
                    )}
                    
                    {/* Order status within trip */}
                    <div className="flex items-center gap-2 mt-2">
                      <Select
                        value={orderStatus}
                        onValueChange={(value) => onUpdateOrderStatus(selectedTrip.id, order.id, value)}
                      >
                        <SelectTrigger className="h-6 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ORDER_TRIP_STATUSES).map(([key, val]) => (
                            <SelectItem key={key} value={key}>
                              <Badge className={`${val.color} text-xs`}>{val.label}</Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onRemoveOrderFromTrip(selectedTrip.id, order.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Убрать
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

const TripMap = ({
  isLoaded,
  selectedTrip,
  orders,
  warehouseCoords,
  tripDirections,
  currentSection,
  onTripMapLoad,
  onBuildTripRoute
}) => {
  if (!selectedTrip) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Карта маршрута
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Выберите рейс для просмотра маршрута</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tripOrders = selectedTrip.orderIds
    ?.map(id => orders.find(o => o.id === id))
    .filter(o => o && o.lat && o.lng) || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Маршрут: {selectedTrip.name}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={onBuildTripRoute}
            disabled={tripOrders.length < 1}
          >
            <Navigation className="h-4 w-4 mr-1" />
            Построить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!isLoaded ? (
          <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '400px' }}
            center={
              warehouseCoords?.lat 
                ? warehouseCoords 
                : tripOrders[0] 
                  ? { lat: tripOrders[0].lat, lng: tripOrders[0].lng }
                  : { lat: 52.0693, lng: 19.4803 }
            }
            zoom={8}
            onLoad={onTripMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false
            }}
          >
            {/* Trip order markers */}
            {tripOrders.map((order, index) => (
              <Marker
                key={order.id}
                position={{ lat: order.lat, lng: order.lng }}
                label={{
                  text: String(index + 1),
                  color: 'white',
                  fontWeight: 'bold'
                }}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 14,
                  fillColor: currentSection?.markerColor || '#2563eb',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 2
                }}
                title={`${index + 1}. ${order.fullName || order.customerName}`}
              />
            ))}
            
            {/* Warehouse marker */}
            {warehouseCoords?.lat && warehouseCoords?.lng && (
              <Marker
                position={warehouseCoords}
                title="Склад (начало/конец маршрута)"
                icon={{
                  path: 'M12 2L2 7v15h20V7L12 2zm0 2.5L19 8v12H5V8l7-3.5z',
                  fillColor: '#9333ea',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 2,
                  scale: 1.5,
                  anchor: new window.google.maps.Point(12, 12)
                }}
              />
            )}
            
            {/* Route directions */}
            {tripDirections && (
              <DirectionsRenderer
                directions={tripDirections}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: currentSection?.markerColor || '#2563eb',
                    strokeWeight: 4,
                    strokeOpacity: 0.8
                  }
                }}
              />
            )}
          </GoogleMap>
        )}
      </CardContent>
    </Card>
  );
};

export default TripDetails;
export { TripMap };
