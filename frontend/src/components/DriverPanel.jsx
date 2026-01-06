import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { toast } from 'sonner';
import {
  Truck, MapPin, Phone, User, Package, CheckCircle, Camera, Navigation,
  RefreshCw, ChevronDown, ChevronUp, DollarSign, FileText, AlertCircle,
  List, Map as MapIcon, Clock, Play, LogOut, Route
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const libraries = ['places', 'geometry'];

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '8px'
};

const defaultCenter = {
  lat: 52.0693,
  lng: 19.4803
};

const ORDER_STATUSES = {
  pending: { label: 'Ожидает', color: 'bg-gray-100 text-gray-700' },
  delivering: { label: 'В пути', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-700' }
};

const TRIP_STATUSES = {
  planned: { label: 'Готов к отправке', color: 'bg-yellow-100 text-yellow-700' },
  in_transit: { label: 'В пути', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Завершён', color: 'bg-green-100 text-green-700' }
};

export const DriverPanel = ({ onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [driver, setDriver] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(null);
  const [activeTab, setActiveTab] = useState('route');
  const [deliveryForm, setDeliveryForm] = useState({
    receivedAmount: '',
    notes: '',
    photo: null
  });
  const [uploading, setUploading] = useState(false);
  const [directions, setDirections] = useState(null);
  const [buildingRoute, setBuildingRoute] = useState(false);
  const [startingTrip, setStartingTrip] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries
  });

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/driver-panel/my-trips`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.trips) {
        setTrips(data.trips);
        if (data.trips.length > 0 && !selectedTrip) {
          setSelectedTrip(data.trips[0]);
        } else if (selectedTrip) {
          // Update selected trip data
          const updated = data.trips.find(t => t.id === selectedTrip.id);
          if (updated) setSelectedTrip(updated);
        }
      }
      if (data.driver) {
        setDriver(data.driver);
      }
      if (data.message && !data.driver) {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error('Ошибка загрузки рейсов');
    } finally {
      setLoading(false);
    }
  }, [selectedTrip]);

  useEffect(() => {
    fetchTrips();
  }, []);

  // Build route when trip is selected
  const buildRoute = useCallback(async () => {
    if (!selectedTrip || !selectedTrip.orders || selectedTrip.orders.length === 0 || !isLoaded) return;
    
    const ordersWithCoords = selectedTrip.orders.filter(o => o.lat && o.lng);
    if (ordersWithCoords.length < 1) return;

    setBuildingRoute(true);
    
    try {
      const directionsService = new window.google.maps.DirectionsService();
      
      // Use first order as origin, last as destination
      const waypoints = ordersWithCoords.slice(1, -1).map(order => ({
        location: { lat: order.lat, lng: order.lng },
        stopover: true
      }));

      const result = await directionsService.route({
        origin: { lat: ordersWithCoords[0].lat, lng: ordersWithCoords[0].lng },
        destination: ordersWithCoords.length > 1 
          ? { lat: ordersWithCoords[ordersWithCoords.length - 1].lat, lng: ordersWithCoords[ordersWithCoords.length - 1].lng }
          : { lat: ordersWithCoords[0].lat, lng: ordersWithCoords[0].lng },
        waypoints: waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false // Keep order as specified
      });

      setDirections(result);
    } catch (error) {
      console.error('Error building route:', error);
    } finally {
      setBuildingRoute(false);
    }
  }, [selectedTrip, isLoaded]);

  useEffect(() => {
    if (selectedTrip && isLoaded) {
      buildRoute();
    }
  }, [selectedTrip, isLoaded, buildRoute]);

  // Open entire route in Google Maps navigator
  const openFullRouteInNavigator = () => {
    if (!selectedTrip || !selectedTrip.orders) return;
    
    const ordersWithCoords = selectedTrip.orders.filter(o => o.lat && o.lng);
    if (ordersWithCoords.length === 0) {
      toast.error('Нет адресов с координатами');
      return;
    }

    let url = 'https://www.google.com/maps/dir/?api=1';
    url += `&origin=${ordersWithCoords[0].lat},${ordersWithCoords[0].lng}`;
    
    if (ordersWithCoords.length > 1) {
      const last = ordersWithCoords[ordersWithCoords.length - 1];
      url += `&destination=${last.lat},${last.lng}`;
    } else {
      url += `&destination=${ordersWithCoords[0].lat},${ordersWithCoords[0].lng}`;
    }
    
    if (ordersWithCoords.length > 2) {
      const waypoints = ordersWithCoords.slice(1, -1)
        .map(o => `${o.lat},${o.lng}`)
        .join('|');
      url += `&waypoints=${waypoints}`;
    }
    
    url += '&travelmode=driving';
    window.open(url, '_blank');
  };

  // Open single order in navigator
  const openOrderInNavigator = (order) => {
    if (!order.lat || !order.lng) {
      toast.error('У заказа нет координат');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Start trip - change all statuses to "delivering"
  const handleStartTrip = async () => {
    if (!selectedTrip) return;
    
    setStartingTrip(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/driver-panel/start-trip/${selectedTrip.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || 'Рейс начат!');
        fetchTrips(); // Refresh data
      } else {
        toast.error(data.detail || 'Ошибка');
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      toast.error('Ошибка запуска рейса');
    } finally {
      setStartingTrip(false);
    }
  };

  // Handle delivery confirmation
  const handleConfirmDelivery = async (orderId) => {
    if (!selectedTrip) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('authToken');
      
      if (deliveryForm.photo) {
        const formData = new FormData();
        formData.append('tripId', selectedTrip.id);
        formData.append('orderId', orderId);
        formData.append('receivedAmount', deliveryForm.receivedAmount || '');
        formData.append('photo', deliveryForm.photo);

        const uploadResponse = await fetch(`${API_URL}/api/driver-panel/upload-photo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error('Ошибка загрузки фото');
        }
      } else {
        const response = await fetch(`${API_URL}/api/driver-panel/confirm-delivery`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tripId: selectedTrip.id,
            orderId: orderId,
            isDelivered: true,
            receivedAmount: deliveryForm.receivedAmount,
            deliveryNotes: deliveryForm.notes
          })
        });

        if (!response.ok) {
          throw new Error('Ошибка подтверждения');
        }
      }

      toast.success('Доставка подтверждена');
      setConfirmingDelivery(null);
      setDeliveryForm({ receivedAmount: '', notes: '', photo: null });
      fetchTrips();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast.error(error.message || 'Ошибка');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('Фото будет сжато');
      }
      setDeliveryForm(prev => ({ ...prev, photo: file }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    if (onLogout) onLogout();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Водитель не найден</h2>
            <p className="text-muted-foreground mb-4">
              Ваша учётная запись не связана с профилем водителя. 
              Обратитесь к администратору.
            </p>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20" data-testid="driver-panel">
      {/* Header */}
      <div className="bg-purple-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6" />
            <div>
              <h1 className="font-semibold">Кабинет водителя</h1>
              <p className="text-sm text-purple-200">{driver.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-purple-500"
              onClick={fetchTrips}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-purple-500"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Trip selector */}
      {trips.length > 1 && (
        <div className="p-4 bg-white border-b">
          <Label className="text-sm text-muted-foreground mb-2 block">Выберите рейс:</Label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {trips.map(trip => (
              <Button
                key={trip.id}
                variant={selectedTrip?.id === trip.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTrip(trip)}
                className="whitespace-nowrap"
              >
                {trip.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {trips.length === 0 ? (
        <div className="p-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Нет активных рейсов</h2>
              <p className="text-muted-foreground">
                Вам пока не назначены рейсы. Ожидайте назначения.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : selectedTrip && (
        <div className="flex flex-col h-[calc(100vh-140px)]">
          {/* Trip info header */}
          <div className="px-4 pt-4 pb-2">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{selectedTrip.name}</div>
                  <Badge className={TRIP_STATUSES[selectedTrip.status]?.color || 'bg-gray-100'}>
                    {TRIP_STATUSES[selectedTrip.status]?.label || selectedTrip.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {selectedTrip.departureDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(selectedTrip.departureDate).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    {selectedTrip.orders?.length || 0} заказов
                  </span>
                  <span className="text-green-600">
                    ✓ {Object.values(selectedTrip.orderStatuses || {}).filter(s => s === 'delivered').length}
                  </span>
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  {selectedTrip.status === 'planned' && (
                    <Button 
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={handleStartTrip}
                      disabled={startingTrip}
                      data-testid="start-trip-btn"
                    >
                      {startingTrip ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      В путь
                    </Button>
                  )}
                  <Button 
                    className={`${selectedTrip.status === 'planned' ? '' : 'flex-1'} bg-green-600 hover:bg-green-700`}
                    onClick={openFullRouteInNavigator}
                    data-testid="open-route-btn"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Навигатор
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="route" className="gap-1 text-xs sm:text-sm">
                  <Route className="h-4 w-4" />
                  Маршрут
                </TabsTrigger>
                <TabsTrigger value="orders" className="gap-1 text-xs sm:text-sm">
                  <Package className="h-4 w-4" />
                  Заказы
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Route Tab - Map only */}
            <TabsContent value="route" className="flex-1 p-4 pt-2 m-0">
              <Card className="h-full">
                <CardContent className="p-2 h-full">
                  {isLoaded ? (
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%', minHeight: '450px', borderRadius: '8px' }}
                      center={
                        selectedTrip.orders?.[0]?.lat 
                          ? { lat: selectedTrip.orders[0].lat, lng: selectedTrip.orders[0].lng }
                          : defaultCenter
                      }
                      zoom={11}
                    >
                      {/* Order markers with numbers */}
                      {selectedTrip.orders?.map((order, index) => (
                        order.lat && order.lng && (
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
                              scale: 15,
                              fillColor: order.isImportant ? '#ef4444' : 
                                (selectedTrip.orderStatuses?.[order.id] === 'delivered' ? '#22c55e' : 
                                 selectedTrip.orderStatuses?.[order.id] === 'delivering' ? '#3b82f6' : '#8b5cf6'),
                              fillOpacity: 1,
                              strokeColor: 'white',
                              strokeWeight: 2
                            }}
                            onClick={() => {
                              setExpandedOrder(order.id);
                              setActiveTab('orders');
                            }}
                          />
                        )
                      ))}

                      {/* Route line */}
                      {directions && (
                        <DirectionsRenderer
                          directions={directions}
                          options={{
                            suppressMarkers: true,
                            polylineOptions: {
                              strokeColor: '#8b5cf6',
                              strokeWeight: 4,
                              strokeOpacity: 0.8
                            }
                          }}
                        />
                      )}
                    </GoogleMap>
                  ) : (
                    <div className="h-full min-h-[450px] flex items-center justify-center bg-gray-100 rounded">
                      <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Route loading indicator */}
              {buildingRoute && (
                <div className="mt-2 text-center text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 inline animate-spin mr-1" />
                  Построение маршрута...
                </div>
              )}
              
              {!buildingRoute && !directions && selectedTrip.orders?.length > 0 && (
                <div className="mt-2 text-center text-sm text-yellow-600">
                  {selectedTrip.orders?.some(o => o.lat && o.lng) 
                    ? 'Маршрут не построен. Проверьте координаты адресов.'
                    : `Нет координат. У ${selectedTrip.orders?.length} заказов нет lat/lng.`
                  }
                </div>
              )}
              
              {/* Debug info */}
              <div className="mt-2 text-center text-xs text-muted-foreground">
                Заказов: {selectedTrip.orders?.length || 0}, 
                С координатами: {selectedTrip.orders?.filter(o => o.lat && o.lng).length || 0}
              </div>
            </TabsContent>

            {/* Orders Tab - with phone and amount in collapsed view */}
            <TabsContent value="orders" className="flex-1 overflow-auto p-4 pt-2 m-0 space-y-3">
              {selectedTrip.orders?.map((order, index) => {
                const orderStatus = selectedTrip.orderStatuses?.[order.id] || 'pending';
                const statusInfo = ORDER_STATUSES[orderStatus] || ORDER_STATUSES.pending;
                const isExpanded = expandedOrder === order.id;
                const isConfirming = confirmingDelivery === order.id;
                const isDelivered = orderStatus === 'delivered';

                return (
                  <Card 
                    key={order.id} 
                    className={`transition-all ${order.isImportant ? 'border-orange-300 bg-orange-50' : ''} ${isDelivered ? 'opacity-70' : ''}`}
                    data-testid={`order-card-${order.id}`}
                  >
                    <CardContent className="p-3">
                      {/* Order header - shows phone and amount when collapsed */}
                      <div 
                        className="flex items-start gap-3 cursor-pointer"
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 ${
                          isDelivered ? 'bg-green-100 text-green-700' : 
                          orderStatus === 'delivering' ? 'bg-blue-100 text-blue-700' : 
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {isDelivered ? '✓' : index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{order.fullName || 'Без имени'}</span>
                            {order.isImportant && <span className="text-orange-600">⚠️</span>}
                            <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{order.fullAddress}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          {order.phoneNumber && (
                            <a 
                              href={`tel:${order.phoneNumber}`}
                              className="flex items-center gap-2 text-blue-600 hover:underline"
                            >
                              <Phone className="h-4 w-4" />
                              {order.phoneNumber}
                            </a>
                          )}
                          
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span>{order.fullAddress}</span>
                          </div>
                          
                          {order.orderContents && (
                            <div className="flex items-start gap-2">
                              <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-sm">{order.orderContents}</span>
                            </div>
                          )}

                          {order.orderComment && (
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-sm text-muted-foreground">{order.orderComment}</span>
                            </div>
                          )}

                          {order.debtSum && (
                            <div className="flex items-center gap-2 bg-yellow-50 p-2 rounded">
                              <DollarSign className="h-4 w-4 text-yellow-600" />
                              <span className="text-sm font-medium">К оплате: {order.debtSum}</span>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-2">
                            {order.lat && order.lng && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openOrderInNavigator(order);
                                }}
                                data-testid={`navigate-to-order-${order.id}`}
                              >
                                <Navigation className="h-4 w-4 mr-1" />
                                Навигация
                              </Button>
                            )}
                            
                            {!isDelivered && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmingDelivery(order.id);
                                  setDeliveryForm({
                                    receivedAmount: order.debtSum || '',
                                    notes: '',
                                    photo: null
                                  });
                                }}
                                data-testid={`confirm-delivery-${order.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Доставлено
                              </Button>
                            )}
                          </div>

                          {/* Delivery confirmation form */}
                          {isConfirming && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-3">
                              <h4 className="font-medium">Подтверждение доставки</h4>
                              
                              <div className="space-y-2">
                                <Label>Полученная сумма</Label>
                                <Input
                                  type="text"
                                  placeholder={order.debtSum ? `Ожидается: ${order.debtSum}` : 'Введите сумму'}
                                  value={deliveryForm.receivedAmount}
                                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, receivedAmount: e.target.value }))}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Фото акта</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handlePhotoChange}
                                    className="flex-1"
                                  />
                                  {deliveryForm.photo && (
                                    <Badge variant="secondary">
                                      <Camera className="h-3 w-3 mr-1" />
                                      Выбрано
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                  disabled={uploading}
                                  onClick={() => handleConfirmDelivery(order.id)}
                                >
                                  {uploading ? (
                                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                  )}
                                  Подтвердить
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setConfirmingDelivery(null)}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Already delivered info */}
                          {isDelivered && order.deliveryConfirmedAt && (
                            <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                              <CheckCircle className="h-4 w-4 inline mr-1" />
                              Доставлено {new Date(order.deliveryConfirmedAt).toLocaleString('ru-RU')}
                              {order.receivedAmount && ` • Получено: ${order.receivedAmount}`}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default DriverPanel;
