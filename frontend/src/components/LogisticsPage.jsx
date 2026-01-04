import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { 
  MapPin, 
  Route, 
  Truck, 
  Clock, 
  Navigation,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Package,
  Plus,
  User,
  Phone,
  FileText,
  X
} from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '8px'
};

const defaultCenter = {
  lat: 52.2297,
  lng: 21.0122
};

const libraries = ['places', 'geometry'];

export const LogisticsPage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [buildingRoute, setBuildingRoute] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderType, setOrderType] = useState('all'); // 'all', 'balia', 'sauna'
  
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries
  });

  // Fetch all orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [baliaRes, saunaRes] = await Promise.all([
        fetch(`${API_URL}/api/orders`),
        fetch(`${API_URL}/api/sauna/orders`)
      ]);
      
      const baliaOrders = baliaRes.ok ? await baliaRes.json() : [];
      const saunaOrders = saunaRes.ok ? await saunaRes.json() : [];
      
      // Combine and mark order types
      const allOrders = [
        ...baliaOrders.map(o => ({ ...o, orderType: 'balia' })),
        ...saunaOrders.map(o => ({ ...o, orderType: 'sauna' }))
      ].filter(o => o.fullAddress || o.address);
      
      // Sort by date, newest first
      allOrders.sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt));
      
      setOrders(allOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Initialize geocoder when map is loaded
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();
  }, []);

  // Geocode address to coordinates
  const geocodeAddress = useCallback((address) => {
    return new Promise((resolve, reject) => {
      if (!geocoderRef.current) {
        reject(new Error('Geocoder not initialized'));
        return;
      }
      
      geocoderRef.current.geocode({ address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }, []);

  // Update markers when selection changes
  useEffect(() => {
    const updateMarkers = async () => {
      if (!isLoaded || selectedOrders.length === 0) {
        setMarkers([]);
        return;
      }

      const newMarkers = [];
      for (const orderId of selectedOrders) {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          const address = order.fullAddress || order.address;
          try {
            const coords = await geocodeAddress(address);
            newMarkers.push({
              orderId: order.id,
              position: coords,
              title: `${order.fullName}\n${address}`,
              order
            });
          } catch (error) {
            console.warn(`Failed to geocode address: ${address}`, error);
          }
        }
      }
      setMarkers(newMarkers);

      // Fit bounds to show all markers
      if (newMarkers.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        newMarkers.forEach(marker => bounds.extend(marker.position));
        mapRef.current.fitBounds(bounds);
        
        if (newMarkers.length === 1) {
          mapRef.current.setZoom(14);
        }
      }
    };

    updateMarkers();
  }, [selectedOrders, orders, isLoaded, geocodeAddress]);

  // Toggle order selection
  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
    setDirections(null);
    setRouteInfo(null);
  };

  // Select all visible orders
  const selectAllOrders = () => {
    const filteredOrders = getFilteredOrders();
    const allIds = filteredOrders.map(o => o.id);
    setSelectedOrders(allIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedOrders([]);
    setDirections(null);
    setRouteInfo(null);
    setMarkers([]);
  };

  // Build route between selected orders
  const buildRoute = async () => {
    if (markers.length < 2) {
      toast.error('Выберите минимум 2 заказа для построения маршрута');
      return;
    }

    setBuildingRoute(true);
    
    try {
      const directionsService = new window.google.maps.DirectionsService();
      
      // Use first marker as origin, last as destination, rest as waypoints
      const origin = markers[0].position;
      const destination = markers[markers.length - 1].position;
      const waypoints = markers.slice(1, -1).map(m => ({
        location: m.position,
        stopover: true
      }));

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode.DRIVING
      });

      setDirections(result);

      // Calculate total distance and duration
      let totalDistance = 0;
      let totalDuration = 0;
      result.routes[0].legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      setRouteInfo({
        distance: (totalDistance / 1000).toFixed(1),
        duration: Math.round(totalDuration / 60),
        legs: result.routes[0].legs,
        waypointOrder: result.routes[0].waypoint_order
      });

      toast.success('Маршрут построен');
    } catch (error) {
      console.error('Error building route:', error);
      toast.error('Ошибка построения маршрута');
    } finally {
      setBuildingRoute(false);
    }
  };

  // Open route in Google Maps
  const openInGoogleMaps = () => {
    if (markers.length < 2) return;

    const origin = markers[0].position;
    const destination = markers[markers.length - 1].position;
    const waypoints = markers.slice(1, -1).map(m => `${m.position.lat},${m.position.lng}`).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    url += '&travelmode=driving';

    window.open(url, '_blank');
  };

  // Filter orders by type
  const getFilteredOrders = () => {
    if (orderType === 'all') return orders;
    return orders.filter(o => o.orderType === orderType);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Format duration
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}ч ${mins}мин`;
    }
    return `${mins}мин`;
  };

  if (loadError) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Ошибка загрузки Google Maps. Проверьте API ключ.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredOrders = getFilteredOrders();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-8 w-8 text-[#355c7d]" />
          <h1 className="text-2xl font-bold text-gray-900">Логистика</h1>
        </div>
        <Button variant="outline" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Заказы с адресами
              </CardTitle>
              <Badge variant="secondary">{filteredOrders.length}</Badge>
            </div>
            
            {/* Filter tabs */}
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                variant={orderType === 'all' ? 'default' : 'outline'}
                onClick={() => setOrderType('all')}
              >
                Все
              </Button>
              <Button 
                size="sm" 
                variant={orderType === 'balia' ? 'default' : 'outline'}
                onClick={() => setOrderType('balia')}
              >
                Бали
              </Button>
              <Button 
                size="sm" 
                variant={orderType === 'sauna' ? 'default' : 'outline'}
                onClick={() => setOrderType('sauna')}
              >
                Сауны
              </Button>
            </div>

            {/* Selection controls */}
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={selectAllOrders}>
                Выбрать все
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                Снять выбор
              </Button>
              {selectedOrders.length > 0 && (
                <Badge className="ml-auto">Выбрано: {selectedOrders.length}</Badge>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="max-h-[500px] overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Загрузка...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Нет заказов с адресами</div>
            ) : (
              filteredOrders.map((order) => {
                const address = order.fullAddress || order.address;
                const isSelected = selectedOrders.includes(order.id);
                const isExpanded = expandedOrder === order.id;
                
                return (
                  <div
                    key={order.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isSelected 
                        ? 'border-[#355c7d] bg-[#355c7d]/5' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">
                            {order.fullName}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={order.orderType === 'balia' ? 'text-blue-600' : 'text-orange-600'}
                          >
                            {order.orderType === 'balia' ? 'Баля' : 'Сауна'}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-1 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span className="break-words">{address}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDate(order.orderDate || order.createdAt)} • #{order.id?.slice(-6)}
                        </div>
                        
                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t text-sm space-y-1">
                            {order.phoneNumber && (
                              <div>📞 {order.phoneNumber}</div>
                            )}
                            {order.modelName && (
                              <div>📦 {order.modelName}</div>
                            )}
                            {order.total && (
                              <div>💰 {order.total.toLocaleString()} zł</div>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Карта
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={buildRoute}
                  disabled={selectedOrders.length < 2 || buildingRoute || !isLoaded}
                  className="bg-[#355c7d] hover:bg-[#2a4a63]"
                >
                  {buildingRoute ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Route className="h-4 w-4 mr-2" />
                  )}
                  Построить маршрут
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {!isLoaded ? (
              <div className="h-[500px] flex items-center justify-center bg-gray-100 rounded-lg">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
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
                {/* Markers */}
                {!directions && markers.map((marker, index) => (
                  <Marker
                    key={marker.orderId}
                    position={marker.position}
                    label={{
                      text: String(index + 1),
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                    title={marker.title}
                  />
                ))}

                {/* Directions */}
                {directions && (
                  <DirectionsRenderer
                    directions={directions}
                    options={{
                      suppressMarkers: false,
                      polylineOptions: {
                        strokeColor: '#355c7d',
                        strokeWeight: 4
                      }
                    }}
                  />
                )}
              </GoogleMap>
            )}

            {/* Route Info */}
            {routeInfo && (
              <div className="mt-4 p-4 bg-[#355c7d]/5 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Информация о маршруте</h3>
                  <Button size="sm" onClick={openInGoogleMaps}>
                    <Navigation className="h-4 w-4 mr-2" />
                    Открыть в Google Maps
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Route className="h-5 w-5 text-[#355c7d]" />
                    <div>
                      <div className="text-sm text-gray-500">Расстояние</div>
                      <div className="font-semibold">{routeInfo.distance} км</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#355c7d]" />
                    <div>
                      <div className="text-sm text-gray-500">Время в пути</div>
                      <div className="font-semibold">{formatDuration(routeInfo.duration)}</div>
                    </div>
                  </div>
                </div>
                
                {/* Route legs */}
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-gray-700">Порядок точек:</div>
                  {routeInfo.legs.map((leg, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                        {index + 1}
                      </Badge>
                      <span className="text-gray-600 truncate flex-1">{leg.start_address}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-500">{leg.distance.text}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0 bg-green-50 text-green-600">
                      ✓
                    </Badge>
                    <span className="text-gray-600 truncate flex-1">
                      {routeInfo.legs[routeInfo.legs.length - 1]?.end_address}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {selectedOrders.length === 0 && !loading && (
              <div className="mt-4 text-center text-gray-500 text-sm">
                Выберите заказы из списка слева, чтобы увидеть их на карте
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LogisticsPage;
