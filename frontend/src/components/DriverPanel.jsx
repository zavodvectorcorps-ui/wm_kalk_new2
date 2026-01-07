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
  List, Map as MapIcon, Clock, Play, LogOut, Route, Bell, BellOff
} from 'lucide-react';

// Smart API URL detection - use current origin on production, env var for development
const getApiUrl = () => {
  // If we're on the production domain, use it as API URL
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('wm-kalkulator.pl') || origin.includes('emergent.host')) {
      return origin;
    }
  }
  return process.env.REACT_APP_BACKEND_URL || '';
};

const API_URL = getApiUrl();
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// VAPID public key for push notifications - from environment
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || 'BJTzkaMvUO1s6uOYYjPwwi0UDpBvJpwHB0TYWFkNLGsrhbTxlVnJ2LEdaErMx0GdLBfjsQDqgvmHjuzAEuz7p9A';

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

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
  const [finishingTrip, setFinishingTrip] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [warehouse, setWarehouse] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  
  // Mileage modal states
  const [showMileageModal, setShowMileageModal] = useState(null); // 'start' | 'finish' | null
  const [mileageInput, setMileageInput] = useState('');

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
      // Store warehouse for route building
      if (data.warehouse) {
        setWarehouse(data.warehouse);
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

  // Check push notification support and status
  const checkPushStatus = useCallback(async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushEnabled(!!subscription);
      } catch (e) {
        console.error('Error checking push status:', e);
      }
    }
  }, []);

  // Subscribe to push notifications
  const subscribeToPush = async () => {
    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    if (isIOS && !isStandalone) {
      toast.error(
        'На iPhone: нажмите "Поделиться" → "На экран Домой", затем откройте приложение с главного экрана',
        { duration: 8000 }
      );
      return;
    }
    
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Разрешите уведомления в настройках браузера');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Send subscription to server
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
          }
        })
      });

      if (response.ok) {
        setPushEnabled(true);
        toast.success('Push-уведомления включены!');
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Server error');
      }
    } catch (error) {
      console.error('Push subscription error:', error);
      // Show detailed error message
      let errorMsg = 'Ошибка подписки на уведомления';
      if (error.name === 'NotAllowedError') {
        errorMsg = 'Разрешите уведомления в настройках браузера';
      } else if (error.name === 'NotSupportedError') {
        errorMsg = 'Push-уведомления не поддерживаются в этом браузере';
      } else if (error.message) {
        errorMsg = `Ошибка: ${error.message}`;
      }
      toast.error(errorMsg, { duration: 5000 });
    }
  };

  // Unsubscribe from push
  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        setPushEnabled(false);
        toast.success('Push-уведомления отключены');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  };

  // Load notification history
  const loadNotificationHistory = async () => {
    setLoadingNotifications(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/notifications/history/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotificationHistory(data.notifications || []);
        setUnreadNotificationsCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to load notification history:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Mark notifications as read
  const markNotificationsAsRead = async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_URL}/api/notifications/history/mark-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUnreadNotificationsCount(0);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // Fetch unread count on mount
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/notifications/history/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadNotificationsCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Toggle notification panel and load history
  const toggleNotificationPanel = () => {
    if (!showNotifications) {
      loadNotificationHistory();
      // Mark as read when opening panel
      markNotificationsAsRead();
    }
    setShowNotifications(!showNotifications);
  };

  useEffect(() => {
    fetchTrips();
    checkPushStatus();
  }, [checkPushStatus]);

  // Build route when trip is selected - uses warehouse as start point if available
  const buildRoute = useCallback(async () => {
    if (!selectedTrip || !selectedTrip.orders || selectedTrip.orders.length === 0 || !isLoaded) return;
    
    const ordersWithCoords = selectedTrip.orders.filter(o => o.lat && o.lng);
    if (ordersWithCoords.length < 1) return;

    setBuildingRoute(true);
    
    try {
      const directionsService = new window.google.maps.DirectionsService();
      
      // Use warehouse as origin if available, otherwise first order
      let origin;
      const tripWarehouse = selectedTrip.warehouse || warehouse;
      // Check both naming conventions
      const whLat = tripWarehouse?.lat || tripWarehouse?.warehouse_lat;
      const whLng = tripWarehouse?.lng || tripWarehouse?.warehouse_lng;
      
      if (tripWarehouse && whLat && whLng) {
        origin = { lat: whLat, lng: whLng };
      } else {
        origin = { lat: ordersWithCoords[0].lat, lng: ordersWithCoords[0].lng };
      }
      
      // Destination is the last order
      const destination = { 
        lat: ordersWithCoords[ordersWithCoords.length - 1].lat, 
        lng: ordersWithCoords[ordersWithCoords.length - 1].lng 
      };
      
      // Waypoints are all orders except the last (which is destination)
      // If warehouse is origin, include all orders as waypoints except last
      let waypoints;
      if (tripWarehouse && whLat) {
        // All orders except last are waypoints
        waypoints = ordersWithCoords.slice(0, -1).map(order => ({
          location: { lat: order.lat, lng: order.lng },
          stopover: true
        }));
      } else {
        // First order is origin, so waypoints start from second
        waypoints = ordersWithCoords.slice(1, -1).map(order => ({
          location: { lat: order.lat, lng: order.lng },
          stopover: true
        }));
      }

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false // Keep order as specified in logistics
      });

      setDirections(result);
    } catch (error) {
      console.error('Error building route:', error);
    } finally {
      setBuildingRoute(false);
    }
  }, [selectedTrip, isLoaded, warehouse]);

  useEffect(() => {
    if (selectedTrip && isLoaded) {
      buildRoute();
    }
  }, [selectedTrip, isLoaded, buildRoute]);

  // Open entire route in Google Maps navigator - use addresses for better display
  const openFullRouteInNavigator = () => {
    if (!selectedTrip || !selectedTrip.orders) return;
    
    const ordersWithCoords = selectedTrip.orders.filter(o => o.lat && o.lng);
    if (ordersWithCoords.length === 0) {
      toast.error('Нет адресов с координатами');
      return;
    }

    // Start from warehouse if available
    const tripWarehouse = selectedTrip.warehouse || warehouse;
    // Check both naming conventions
    const whLat = tripWarehouse?.lat || tripWarehouse?.warehouse_lat;
    const whLng = tripWarehouse?.lng || tripWarehouse?.warehouse_lng;
    const whAddr = tripWarehouse?.address || tripWarehouse?.warehouse_address;
    
    let url = 'https://www.google.com/maps/dir/?api=1';
    
    if (tripWarehouse && whLat && whLng) {
      // Use warehouse address if available
      url += `&origin=${whAddr ? encodeURIComponent(whAddr) : `${whLat},${whLng}`}`;
    } else {
      const firstOrder = ordersWithCoords[0];
      const firstAddr = firstOrder.fullAddress || firstOrder.address;
      url += `&origin=${firstAddr ? encodeURIComponent(firstAddr) : `${firstOrder.lat},${firstOrder.lng}`}`;
    }
    
    // Destination is always the last order - use address
    const last = ordersWithCoords[ordersWithCoords.length - 1];
    const lastAddr = last.fullAddress || last.address;
    url += `&destination=${lastAddr ? encodeURIComponent(lastAddr) : `${last.lat},${last.lng}`}`;
    
    // Add waypoints - all orders except the last (which is destination)
    // If warehouse is origin, all orders except last are waypoints
    let waypointOrders;
    if (tripWarehouse && whLat) {
      waypointOrders = ordersWithCoords.slice(0, -1);
    } else {
      waypointOrders = ordersWithCoords.slice(1, -1);
    }
    
    if (waypointOrders.length > 0) {
      const waypoints = waypointOrders
        .map(o => {
          const addr = o.fullAddress || o.address;
          return addr ? encodeURIComponent(addr) : `${o.lat},${o.lng}`;
        })
        .join('|');
      url += `&waypoints=${waypoints}`;
    }
    
    url += '&travelmode=driving';
    window.open(url, '_blank');
  };

  // Open single order in navigator - use address instead of just coordinates
  const openOrderInNavigator = (order) => {
    if (!order.lat || !order.lng) {
      toast.error('У заказа нет координат');
      return;
    }
    // Use address if available, otherwise coordinates
    const destination = order.fullAddress || order.address 
      ? encodeURIComponent(order.fullAddress || order.address)
      : `${order.lat},${order.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Start trip - change all statuses to "delivering"
  // Handle start trip - opens mileage modal first
  const handleStartTripClick = () => {
    if (!selectedTrip) return;
    setMileageInput('');
    setShowMileageModal('start');
  };

  const handleStartTrip = async () => {
    if (!selectedTrip) return;
    
    setStartingTrip(true);
    try {
      const token = localStorage.getItem('authToken');
      const startMileage = mileageInput ? parseInt(mileageInput, 10) : null;
      
      const response = await fetch(`${API_URL}/api/driver-panel/start-trip/${selectedTrip.id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startMileage })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || 'Рейс начат!');
        setShowMileageModal(null);
        setMileageInput('');
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

  // Handle finish trip - opens mileage modal first
  const handleFinishTripClick = () => {
    if (!selectedTrip) return;
    // Pre-fill with start mileage + estimated distance if available
    const startMileage = selectedTrip.mileage?.start;
    if (startMileage && selectedTrip.estimatedDistance) {
      const estimatedEnd = startMileage + Math.round(selectedTrip.estimatedDistance);
      setMileageInput(estimatedEnd.toString());
    } else {
      setMileageInput('');
    }
    setShowMileageModal('finish');
  };

  const handleFinishTrip = async () => {
    if (!selectedTrip) return;
    
    setFinishingTrip(true);
    try {
      const token = localStorage.getItem('authToken');
      const endMileage = mileageInput ? parseInt(mileageInput, 10) : null;
      
      const response = await fetch(`${API_URL}/api/driver-panel/finish-trip/${selectedTrip.id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endMileage })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || 'Рейс завершён!');
        setShowMileageModal(null);
        setMileageInput('');
        fetchTrips(); // Refresh data
      } else {
        toast.error(data.detail || 'Ошибка');
      }
    } catch (error) {
      console.error('Error finishing trip:', error);
      toast.error('Ошибка завершения рейса');
    } finally {
      setFinishingTrip(false);
    }
  };

  // Handle delivery confirmation
  const handleConfirmDelivery = async (orderId) => {
    if (!selectedTrip) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('authToken');
      const order = selectedTrip.orders?.find(o => o.id === orderId);
      
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
        
        // Sync photo to amoCRM if order has amocrm_id
        if (order?.amocrm_id) {
          try {
            await fetch(`${API_URL}/api/integrations/amocrm/upload-delivery-photo?amocrm_id=${order.amocrm_id}&order_id=${orderId}&driver_name=${encodeURIComponent(driver?.name || '')}&received_amount=${encodeURIComponent(deliveryForm.receivedAmount || '')}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
          } catch (e) {
            console.warn('amoCRM sync failed:', e);
          }
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

  // Geocode all orders in trip that don't have coordinates
  const handleGeocodeTrip = async () => {
    if (!selectedTrip) return;
    
    setGeocoding(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/driver-panel/geocode-trip/${selectedTrip.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.geocoded > 0) {
          toast.success(`Геокодировано ${data.geocoded} адресов`);
          fetchTrips(); // Refresh data
        } else if (data.failed > 0) {
          toast.warning(`Не удалось определить ${data.failed} адресов`);
        } else {
          toast.info(data.message || 'Все адреса уже имеют координаты');
        }
      } else {
        toast.error(data.detail || 'Ошибка геокодирования');
      }
    } catch (error) {
      console.error('Error geocoding trip:', error);
      toast.error('Ошибка определения координат');
    } finally {
      setGeocoding(false);
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
            {/* Push notification toggle */}
            {pushSupported && (
              <Button 
                variant="ghost" 
                size="sm" 
                className={`text-white ${pushEnabled ? 'hover:bg-green-500 bg-green-600/50' : 'hover:bg-purple-500'}`}
                onClick={pushEnabled ? unsubscribeFromPush : subscribeToPush}
                title={pushEnabled ? 'Отключить уведомления' : 'Включить уведомления'}
              >
                {pushEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </Button>
            )}
            {/* Notification history button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className={`text-white relative ${showNotifications ? 'bg-purple-500' : 'hover:bg-purple-500'}`}
              onClick={toggleNotificationPanel}
              title="История уведомлений"
            >
              <List className="h-4 w-4" />
              {notificationHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {notificationHistory.length > 9 ? '9+' : notificationHistory.length}
                </span>
              )}
            </Button>
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

      {/* Notification history panel */}
      {showNotifications && (
        <div className="bg-white border-b shadow-md">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4" />
                История уведомлений
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadNotificationHistory}
                disabled={loadingNotifications}
              >
                <RefreshCw className={`h-4 w-4 ${loadingNotifications ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {loadingNotifications ? (
              <div className="text-center py-4 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                Загрузка...
              </div>
            ) : notificationHistory.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Нет уведомлений</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notificationHistory.map((notif, index) => (
                  <div 
                    key={notif.id || index} 
                    className={`p-3 rounded-lg border ${notif.status === 'sent' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium flex-1">{notif.message}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {notif.method || 'Push'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(notif.sentAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {notif.sentBy && <span>• от {notif.sentBy}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                      onClick={handleStartTripClick}
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
                  {selectedTrip.status === 'in_transit' && (
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={handleFinishTripClick}
                      disabled={finishingTrip}
                      data-testid="finish-trip-btn"
                    >
                      {finishingTrip ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Завершить рейс
                    </Button>
                  )}
                  <Button 
                    className={`${selectedTrip.status === 'planned' || selectedTrip.status === 'in_transit' ? '' : 'flex-1'} bg-purple-600 hover:bg-purple-700`}
                    onClick={openFullRouteInNavigator}
                    data-testid="open-route-btn"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Навигатор
                  </Button>
                </div>
                
                {/* Show mileage info if available */}
                {selectedTrip.mileage && (
                  <div className="mt-3 p-2 bg-gray-100 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck className="h-4 w-4" />
                      <span className="font-medium">Пробег:</span>
                      {selectedTrip.mileage.start && (
                        <span>начало: {selectedTrip.mileage.start} км</span>
                      )}
                      {selectedTrip.mileage.end && (
                        <span>→ конец: {selectedTrip.mileage.end} км</span>
                      )}
                      {selectedTrip.mileage.total && (
                        <span className="font-semibold text-purple-600">
                          = {selectedTrip.mileage.total} км
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mileage Modal */}
          {showMileageModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    {showMileageModal === 'start' ? 'Начать рейс' : 'Завершить рейс'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      {showMileageModal === 'start' 
                        ? 'Текущий пробег одометра (км)' 
                        : 'Текущий пробег одометра (км)'}
                    </label>
                    <Input
                      type="number"
                      placeholder="Например: 125430"
                      value={mileageInput}
                      onChange={(e) => setMileageInput(e.target.value)}
                      className="text-lg"
                      autoFocus
                    />
                    {showMileageModal === 'finish' && selectedTrip?.mileage?.start && (
                      <p className="text-xs text-gray-500 mt-1">
                        Пробег на начало: {selectedTrip.mileage.start} км
                        {mileageInput && parseInt(mileageInput) > selectedTrip.mileage.start && (
                          <span className="text-purple-600 font-medium ml-2">
                            (пройдено: {parseInt(mileageInput) - selectedTrip.mileage.start} км)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowMileageModal(null);
                        setMileageInput('');
                      }}
                    >
                      Отмена
                    </Button>
                    <Button
                      className={`flex-1 ${showMileageModal === 'start' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                      onClick={showMileageModal === 'start' ? handleStartTrip : handleFinishTrip}
                      disabled={startingTrip || finishingTrip}
                    >
                      {(startingTrip || finishingTrip) ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : showMileageModal === 'start' ? (
                        <Play className="h-4 w-4 mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {showMileageModal === 'start' ? 'В путь' : 'Завершить'}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-gray-500 text-center">
                    {showMileageModal === 'start' 
                      ? 'Можно пропустить, если не нужен учёт пробега'
                      : 'Укажите показания одометра для расчёта пробега'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

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
                      {/* Warehouse marker - green house icon */}
                      {(() => {
                        const wh = selectedTrip.warehouse || warehouse;
                        // Check both naming conventions: lat/lng and warehouse_lat/warehouse_lng
                        const whLat = wh?.lat || wh?.warehouse_lat;
                        const whLng = wh?.lng || wh?.warehouse_lng;
                        const whAddr = wh?.address || wh?.warehouse_address;
                        if (wh && whLat && whLng) {
                          return (
                            <Marker
                              position={{ lat: whLat, lng: whLng }}
                              title={`Склад: ${whAddr || 'Начальная точка'}`}
                              icon={{
                                path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                                scale: 1.5,
                                fillColor: '#22c55e',
                                fillOpacity: 1,
                                strokeColor: 'white',
                                strokeWeight: 2,
                                anchor: new window.google.maps.Point(12, 22)
                              }}
                            />
                          );
                        }
                        return null;
                      })()}

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
                <div className="mt-2 text-center space-y-2">
                  <div className="text-sm text-yellow-600">
                    {selectedTrip.orders?.some(o => o.lat && o.lng) 
                      ? 'Маршрут не построен. Проверьте координаты адресов.'
                      : `Нет координат. У ${selectedTrip.orders?.length} заказов нет lat/lng.`
                    }
                  </div>
                  {/* Geocode button when orders lack coordinates */}
                  {selectedTrip.orders?.some(o => !o.lat || !o.lng) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGeocodeTrip}
                      disabled={geocoding}
                      className="text-xs"
                      data-testid="geocode-trip-btn"
                    >
                      {geocoding ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <MapPin className="h-3 w-3 mr-1" />
                      )}
                      Определить координаты
                    </Button>
                  )}
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
                          {/* Phone and amount in collapsed view */}
                          {!isExpanded && (
                            <div className="flex items-center gap-3 mt-1 text-xs">
                              {order.phoneNumber && (
                                <a href={`tel:${order.phoneNumber}`} className="text-blue-600 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Phone className="h-3 w-3" />
                                  {order.phoneNumber}
                                </a>
                              )}
                              {order.debtSum && (
                                <span className="text-yellow-600 font-medium flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {order.debtSum}
                                </span>
                              )}
                            </div>
                          )}
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
