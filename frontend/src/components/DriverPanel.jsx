import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import {
  Truck, MapPin, Phone, User, Package, CheckCircle, Camera, Navigation,
  RefreshCw, ChevronDown, ChevronUp, DollarSign, FileText, AlertCircle,
  List, Map as MapIcon, Clock
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

export const DriverPanel = () => {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [driver, setDriver] = useState(null);
  const [activeView, setActiveView] = useState('list'); // 'list', 'map'
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(null);
  const [deliveryForm, setDeliveryForm] = useState({
    receivedAmount: '',
    notes: '',
    photo: null
  });
  const [uploading, setUploading] = useState(false);
  const [directions, setDirections] = useState(null);
  const [buildingRoute, setBuildingRoute] = useState(false);

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

  // Open in Google Maps navigator
  const openInNavigator = () => {
    if (!selectedTrip || !selectedTrip.orders) return;
    
    const ordersWithCoords = selectedTrip.orders.filter(o => o.lat && o.lng);
    if (ordersWithCoords.length === 0) {
      toast.error('Нет адресов с координатами');
      return;
    }

    // Build Google Maps URL with waypoints
    let url = 'https://www.google.com/maps/dir/?api=1';
    
    // Origin
    url += `&origin=${ordersWithCoords[0].lat},${ordersWithCoords[0].lng}`;
    
    // Destination (last point)
    if (ordersWithCoords.length > 1) {
      const last = ordersWithCoords[ordersWithCoords.length - 1];
      url += `&destination=${last.lat},${last.lng}`;
    } else {
      url += `&destination=${ordersWithCoords[0].lat},${ordersWithCoords[0].lng}`;
    }
    
    // Waypoints (middle points)
    if (ordersWithCoords.length > 2) {
      const waypoints = ordersWithCoords.slice(1, -1)
        .map(o => `${o.lat},${o.lng}`)
        .join('|');
      url += `&waypoints=${waypoints}`;
    }
    
    url += '&travelmode=driving';
    
    window.open(url, '_blank');
  };

  // Handle delivery confirmation
  const handleConfirmDelivery = async (orderId) => {
    if (!selectedTrip) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      
      // If there's a photo, upload it
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
        // Just confirm delivery without photo
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

  // Handle photo selection
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Compress image if needed
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('Фото будет сжато');
      }
      setDeliveryForm(prev => ({ ...prev, photo: file }));
    }
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
            <p className="text-muted-foreground">
              Ваша учётная запись не связана с профилем водителя. 
              Обратитесь к администратору.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
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
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:bg-purple-500"
            onClick={fetchTrips}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
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
        <>
          {/* Trip info */}
          <div className="p-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedTrip.name}</CardTitle>
                  <Badge className={selectedTrip.status === 'in_transit' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}>
                    {selectedTrip.status === 'in_transit' ? 'В пути' : 'Готов к отправке'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {selectedTrip.departureDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Дата: {new Date(selectedTrip.departureDate).toLocaleDateString('ru-RU')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>Заказов: {selectedTrip.orders?.length || 0}</span>
                </div>
                <Button 
                  className="w-full mt-3 bg-green-600 hover:bg-green-700"
                  onClick={openInNavigator}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Открыть в навигаторе
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* View tabs */}
          <div className="px-4">
            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="list" className="gap-2">
                  <List className="h-4 w-4" />
                  Список
                </TabsTrigger>
                <TabsTrigger value="map" className="gap-2">
                  <MapIcon className="h-4 w-4" />
                  Карта
                </TabsTrigger>
              </TabsList>

              {/* List view */}
              <TabsContent value="list" className="mt-4 space-y-3">
                {selectedTrip.orders?.map((order, index) => {
                  const orderStatus = selectedTrip.orderStatuses?.[order.id] || 'pending';
                  const statusInfo = ORDER_STATUSES[orderStatus] || ORDER_STATUSES.pending;
                  const isExpanded = expandedOrder === order.id;
                  const isConfirming = confirmingDelivery === order.id;
                  const isDelivered = orderStatus === 'delivered';

                  return (
                    <Card 
                      key={order.id} 
                      className={`transition-all ${order.isImportant ? 'border-orange-300 bg-orange-50' : ''} ${isDelivered ? 'opacity-60' : ''}`}
                    >
                      <CardContent className="p-3">
                        {/* Order header */}
                        <div 
                          className="flex items-start gap-3 cursor-pointer"
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm flex-shrink-0">
                            {index + 1}
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
                                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}&travelmode=driving`, '_blank');
                                  }}
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
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Доставлен
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

              {/* Map view */}
              <TabsContent value="map" className="mt-4">
                <Card>
                  <CardContent className="p-2">
                    {isLoaded ? (
                      <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={
                          selectedTrip.orders?.[0]?.lat 
                            ? { lat: selectedTrip.orders[0].lat, lng: selectedTrip.orders[0].lng }
                            : defaultCenter
                        }
                        zoom={10}
                      >
                        {/* Order markers */}
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
                                  (selectedTrip.orderStatuses?.[order.id] === 'delivered' ? '#22c55e' : '#8b5cf6'),
                                fillOpacity: 1,
                                strokeColor: 'white',
                                strokeWeight: 2
                              }}
                              onClick={() => setExpandedOrder(order.id)}
                            />
                          )
                        ))}

                        {/* Route */}
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
                      <div className="h-[400px] flex items-center justify-center bg-gray-100 rounded">
                        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button 
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  onClick={openInNavigator}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Открыть маршрут в навигаторе
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          {/* Compact list view (like print) */}
          <div className="p-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Краткий список
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y text-xs">
                  {selectedTrip.orders?.map((order, index) => {
                    const isDelivered = selectedTrip.orderStatuses?.[order.id] === 'delivered';
                    return (
                      <div 
                        key={order.id} 
                        className={`p-2 flex gap-2 ${isDelivered ? 'bg-green-50' : ''} ${order.isImportant ? 'bg-orange-50' : ''}`}
                      >
                        <span className="font-bold text-purple-600 w-5">{index + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{order.fullName}</span>
                          {order.isImportant && <span className="ml-1">⚠️</span>}
                          <span className="text-muted-foreground"> • {order.phoneNumber}</span>
                          <p className="text-muted-foreground truncate">{order.fullAddress}</p>
                        </div>
                        {isDelivered && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default DriverPanel;
