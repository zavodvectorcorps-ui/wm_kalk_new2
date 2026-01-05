import React from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { MapPin, Navigation, RefreshCw, Filter, Eye, Star, Warehouse } from 'lucide-react';
import { mapContainerStyle, defaultCenter, getMapOrders, getMarkerIcon, formatDistance, formatDuration } from './constants';

const OrdersMap = ({
  isLoaded,
  sectionData,
  sectionKey,
  currentSection,
  mapFilter,
  setMapFilter,
  onMapLoad,
  warehouseCoords,
  buildingRoute,
  onBuildRoute,
  onMarkerClick
}) => {
  const orders = sectionData[sectionKey]?.orders || [];
  const selectedOrders = sectionData[sectionKey]?.selectedOrders || [];
  const routeInfo = sectionData[sectionKey]?.routeInfo;
  const directions = sectionData[sectionKey]?.directions;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Карта
          </CardTitle>
          <div className="flex gap-2 items-center">
            {/* Map filter */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                size="sm"
                variant={mapFilter === 'free' ? 'default' : 'ghost'}
                onClick={() => setMapFilter('free')}
                className="h-7 text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                Свободные
              </Button>
              <Button
                size="sm"
                variant={mapFilter === 'all' ? 'default' : 'ghost'}
                onClick={() => setMapFilter('all')}
                className="h-7 text-xs"
              >
                <Filter className="h-3 w-3 mr-1" />
                Все
              </Button>
            </div>
            
            {selectedOrders.length > 0 && (
              <Button
                size="sm"
                onClick={onBuildRoute}
                disabled={buildingRoute || selectedOrders.filter(id => {
                  const order = orders.find(o => o.id === id);
                  return order && order.lat && order.lng;
                }).length < 2}
              >
                {buildingRoute ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4 mr-1" />
                )}
                Маршрут ({selectedOrders.length})
              </Button>
            )}
          </div>
        </div>
        
        {/* Map legend */}
        <div className="flex flex-wrap gap-3 text-xs mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Свободные</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span>В рейсе</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Важные</span>
          </div>
          <div className="flex items-center gap-1">
            <Warehouse className="h-3 w-3 text-purple-600" />
            <span>Склад</span>
          </div>
        </div>
        
        {routeInfo && (
          <div className="flex gap-4 text-sm mt-2">
            <span className="flex items-center gap-1">
              <Navigation className="h-4 w-4 text-blue-600" />
              {formatDistance(routeInfo.distance)}
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4 text-green-600" />
              {formatDuration(routeInfo.duration)}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="relative">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-[500px] bg-muted rounded-lg">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={defaultCenter}
              zoom={6}
              onLoad={onMapLoad}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true
              }}
            >
              {/* All orders with coordinates (filtered by mapFilter) */}
              {getMapOrders(orders, mapFilter).map((order) => {
                const isSelected = selectedOrders.includes(order.id);
                const selectedIndex = isSelected 
                  ? selectedOrders.indexOf(order.id) + 1 
                  : null;
                
                return (
                  <Marker
                    key={order.id}
                    position={{ lat: order.lat, lng: order.lng }}
                    title={`${order.fullName || order.customerName}\n${order.fullAddress || order.address}`}
                    label={isSelected ? {
                      text: String(selectedIndex),
                      color: 'white',
                      fontWeight: 'bold'
                    } : undefined}
                    icon={isSelected ? {
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 14,
                      fillColor: currentSection.markerColor,
                      fillOpacity: 1,
                      strokeColor: 'white',
                      strokeWeight: 2
                    } : getMarkerIcon(order)}
                    onClick={() => onMarkerClick(order)}
                  />
                );
              })}
              
              {/* Warehouse marker */}
              {warehouseCoords && warehouseCoords.lat && warehouseCoords.lng && (
                <Marker
                  position={warehouseCoords}
                  title="Склад"
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
              {directions && (
                <DirectionsRenderer
                  directions={directions}
                  options={{
                    suppressMarkers: true,
                    polylineOptions: {
                      strokeColor: currentSection.markerColor,
                      strokeWeight: 4,
                      strokeOpacity: 0.8
                    }
                  }}
                />
              )}
            </GoogleMap>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OrdersMap;
