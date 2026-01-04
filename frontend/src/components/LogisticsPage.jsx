import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
  X,
  Waves,
  Flame,
  Warehouse,
  CheckCircle,
  Circle,
  Send,
  Calendar,
  Users,
  Hash,
  Trash2,
  Settings
} from 'lucide-react';

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

// Delivery status options
const DELIVERY_STATUSES = {
  pending: { label: 'Ожидает', labelPl: 'Oczekuje', color: 'bg-gray-100 text-gray-700', icon: Circle },
  preparing: { label: 'Готовится', labelPl: 'W przygotowaniu', color: 'bg-yellow-100 text-yellow-700', icon: Package },
  in_transit: { label: 'В пути', labelPl: 'W drodze', color: 'bg-blue-100 text-blue-700', icon: Truck },
  delivered: { label: 'Доставлено', labelPl: 'Dostarczone', color: 'bg-green-100 text-green-700', icon: CheckCircle }
};

// Default drivers (can be edited in settings)
const DEFAULT_DRIVERS = [
  { id: 'driver1', name: 'Водитель 1' },
  { id: 'driver2', name: 'Водитель 2' },
  { id: 'driver3', name: 'Водитель 3' }
];

// Section configurations
const SECTIONS = {
  greenhouse: {
    id: 'greenhouse',
    name: { ru: 'Теплицы', pl: 'Szklarnie' },
    icon: Warehouse,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-500',
    endpoint: '/api/greenhouse/orders',
    markerColor: '#16a34a'
  },
  balia: {
    id: 'balia',
    name: { ru: 'Купели', pl: 'Balie' },
    icon: Waves,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-500',
    endpoint: '/api/orders',
    markerColor: '#2563eb'
  },
  sauna: {
    id: 'sauna',
    name: { ru: 'Сауны', pl: 'Sauny' },
    icon: Flame,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-500',
    endpoint: '/api/sauna/orders',
    markerColor: '#ea580c'
  }
};

export const LogisticsPage = () => {
  const [activeSection, setActiveSection] = useState('balia');
  
  // State for each section
  const [sectionData, setSectionData] = useState({
    greenhouse: { orders: [], selectedOrders: [], markers: [], directions: null, routeInfo: null },
    balia: { orders: [], selectedOrders: [], markers: [], directions: null, routeInfo: null },
    sauna: { orders: [], selectedOrders: [], markers: [], directions: null, routeInfo: null }
  });
  
  const [loading, setLoading] = useState(true);
  const [buildingRoute, setBuildingRoute] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  
  // Trips (рейсы) state
  const [trips, setTrips] = useState([]);
  const [activeInnerTab, setActiveInnerTab] = useState('orders'); // 'orders' or 'trips'
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripDriver, setNewTripDriver] = useState('');
  const [creatingTrip, setCreatingTrip] = useState(false);
  
  // Drivers state
  const [drivers, setDrivers] = useState(DEFAULT_DRIVERS);
  const [showDriversModal, setShowDriversModal] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  
  // Bulk actions state
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // New order form state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    fullName: '',
    phoneNumber: '',
    fullAddress: '',
    orderComposition: ''
  });
  const [creatingOrder, setCreatingOrder] = useState(false);
  
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const autocompleteRef = useRef(null);
  const addressInputRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries
  });

  // Get current section data
  const currentData = sectionData[activeSection];
  const currentSection = SECTIONS[activeSection];

  // Load drivers from localStorage
  useEffect(() => {
    const savedDrivers = localStorage.getItem('logistics_drivers');
    if (savedDrivers) {
      try {
        setDrivers(JSON.parse(savedDrivers));
      } catch (e) {
        console.error('Failed to load drivers:', e);
      }
    }
  }, []);

  // Save drivers to localStorage
  const saveDrivers = (newDrivers) => {
    setDrivers(newDrivers);
    localStorage.setItem('logistics_drivers', JSON.stringify(newDrivers));
  };

  // Add driver
  const addDriver = () => {
    if (!newDriverName.trim()) return;
    const newDriver = { id: `driver_${Date.now()}`, name: newDriverName.trim() };
    saveDrivers([...drivers, newDriver]);
    setNewDriverName('');
  };

  // Remove driver
  const removeDriver = (driverId) => {
    saveDrivers(drivers.filter(d => d.id !== driverId));
  };

  // Fetch orders for a specific section
  const fetchSectionOrders = useCallback(async (sectionId) => {
    const section = SECTIONS[sectionId];
    try {
      const res = await fetch(`${API_URL}${section.endpoint}`);
      if (res.ok) {
        const orders = await res.json();
        return orders
          .map(o => ({ ...o, orderType: sectionId }))
          .sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt));
      }
      return [];
    } catch (error) {
      console.error(`Error fetching ${sectionId} orders:`, error);
      return [];
    }
  }, []);

  // Geocode orders that have addresses but no coordinates
  const geocodeOrdersInBackground = useCallback(async (orders, sectionId) => {
    if (!geocoderRef.current) return;
    
    const section = SECTIONS[sectionId];
    const ordersToGeocode = orders.filter(o => 
      (o.fullAddress || o.address) && !o.lat && !o.lng
    );
    
    // Geocode in batches of 5 to avoid rate limits
    for (let i = 0; i < ordersToGeocode.length; i += 5) {
      const batch = ordersToGeocode.slice(i, i + 5);
      
      await Promise.all(batch.map(async (order) => {
        try {
          const address = order.fullAddress || order.address;
          const coords = await new Promise((resolve, reject) => {
            geocoderRef.current.geocode({ address }, (results, status) => {
              if (status === 'OK' && results[0]) {
                resolve({
                  lat: results[0].geometry.location.lat(),
                  lng: results[0].geometry.location.lng()
                });
              } else {
                reject(new Error(status));
              }
            });
          });
          
          // Update order with coordinates in state
          setSectionData(prev => ({
            ...prev,
            [sectionId]: {
              ...prev[sectionId],
              orders: prev[sectionId].orders.map(o => 
                o.id === order.id ? { ...o, lat: coords.lat, lng: coords.lng } : o
              )
            }
          }));
          
          // Also save to database
          fetch(`${API_URL}${section.endpoint}/${order.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...order, lat: coords.lat, lng: coords.lng })
          }).catch(console.error);
          
        } catch (error) {
          console.log(`Could not geocode order ${order.id}: ${error.message}`);
        }
      }));
      
      // Wait between batches to respect rate limits
      if (i + 5 < ordersToGeocode.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }, []);

  // Fetch all orders
  const fetchAllOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [greenhouse, balia, sauna] = await Promise.all([
        fetchSectionOrders('greenhouse'),
        fetchSectionOrders('balia'),
        fetchSectionOrders('sauna')
      ]);
      
      setSectionData(prev => ({
        greenhouse: { ...prev.greenhouse, orders: greenhouse },
        balia: { ...prev.balia, orders: balia },
        sauna: { ...prev.sauna, orders: sauna }
      }));
      
      // Geocode orders in background after loading
      setTimeout(() => {
        if (geocoderRef.current) {
          geocodeOrdersInBackground(greenhouse, 'greenhouse');
          geocodeOrdersInBackground(balia, 'balia');
          geocodeOrdersInBackground(sauna, 'sauna');
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  }, [fetchSectionOrders, geocodeOrdersInBackground]);

  // Fetch trips for a specific section
  const fetchTrips = useCallback(async (section = null) => {
    try {
      const url = section 
        ? `${API_URL}/api/trips?section=${section}` 
        : `${API_URL}/api/trips`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTrips(data);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  }, []);

  // Create new trip from selected orders
  const createTrip = async () => {
    if (!newTripName.trim() || currentData.selectedOrders.length === 0) {
      toast.error('Введите название рейса и выберите заказы');
      return;
    }
    
    setCreatingTrip(true);
    try {
      const driver = drivers.find(d => d.id === newTripDriver);
      const res = await fetch(`${API_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTripName,
          section: activeSection,
          orderIds: currentData.selectedOrders,
          driverId: newTripDriver || null,
          driverName: driver?.name || null
        })
      });
      
      if (res.ok) {
        const trip = await res.json();
        toast.success(`Рейс "${trip.name}" создан`);
        setShowCreateTripModal(false);
        setNewTripName('');
        setNewTripDriver('');
        
        // Refresh data
        fetchAllOrders();
        fetchTrips(activeSection);
        
        // Clear selection
        setSectionData(prev => ({
          ...prev,
          [activeSection]: { ...prev[activeSection], selectedOrders: [] }
        }));
        
        // Switch to trips tab
        setActiveInnerTab('trips');
      } else {
        throw new Error('Failed to create trip');
      }
    } catch (error) {
      console.error('Error creating trip:', error);
      toast.error('Ошибка создания рейса');
    } finally {
      setCreatingTrip(false);
    }
  };

  // Update trip (assign driver, change status)
  const updateTrip = async (tripId, updates) => {
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (res.ok) {
        fetchTrips();
        toast.success('Рейс обновлён');
      }
    } catch (error) {
      console.error('Error updating trip:', error);
      toast.error('Ошибка обновления');
    }
  };

  // Delete trip (return orders to general list)
  const deleteTrip = async (tripId) => {
    if (!window.confirm('Удалить рейс? Заказы вернутся в общий список.')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast.success('Рейс удалён');
        fetchTrips(activeSection);
        fetchAllOrders();
        if (selectedTrip?.id === tripId) {
          setSelectedTrip(null);
        }
      }
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error('Ошибка удаления');
    }
  };

  // Remove order from trip
  const removeOrderFromTrip = async (tripId, orderId) => {
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}/remove-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([orderId])
      });
      
      if (res.ok) {
        fetchTrips();
        fetchAllOrders();
      }
    } catch (error) {
      console.error('Error removing order:', error);
    }
  };

  // Get orders without trip (for general list)
  const getUnassignedOrders = (orders) => {
    return orders.filter(o => !o.tripId);
  };

  useEffect(() => {
    fetchAllOrders();
    fetchTrips();
  }, [fetchAllOrders, fetchTrips]);
  
  // Reload trips when section changes
  useEffect(() => {
    fetchTrips(activeSection);
    setActiveInnerTab('orders');
    setSelectedTrip(null);
  }, [activeSection, fetchTrips]);

  // Initialize geocoder and autocomplete when map is loaded
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();
  }, []);

  // Initialize autocomplete when form opens
  useEffect(() => {
    if (!isLoaded || !showOrderForm || !addressInputRef.current) return;
    if (autocompleteRef.current) return; // Already initialized
    
    // Use legacy Autocomplete (still supported, works reliably)
    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: ['pl', 'de', 'cz', 'sk', 'lt', 'lv', 'ee', 'ua', 'by'] },
        fields: ['formatted_address', 'geometry']
      });
      
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place?.formatted_address) {
          setNewOrderForm(prev => ({ ...prev, fullAddress: place.formatted_address }));
        }
      });
    } catch (e) {
      console.error('Failed to initialize autocomplete:', e);
    }
    
    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, showOrderForm]);

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
      if (!isLoaded || currentData.selectedOrders.length === 0) {
        setSectionData(prev => ({
          ...prev,
          [activeSection]: { ...prev[activeSection], markers: [] }
        }));
        return;
      }

      const newMarkers = [];
      for (const orderId of currentData.selectedOrders) {
        const order = currentData.orders.find(o => o.id === orderId);
        if (order) {
          const address = order.fullAddress || order.address;
          try {
            const coords = await geocodeAddress(address);
            newMarkers.push({
              id: order.id,
              position: coords,
              title: order.fullName || order.customerName,
              address
            });
          } catch (error) {
            console.error(`Failed to geocode: ${address}`, error);
          }
        }
      }
      
      setSectionData(prev => ({
        ...prev,
        [activeSection]: { ...prev[activeSection], markers: newMarkers }
      }));

      // Fit bounds to show all markers
      if (newMarkers.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        newMarkers.forEach(m => bounds.extend(m.position));
        mapRef.current.fitBounds(bounds);
        if (newMarkers.length === 1) {
          mapRef.current.setZoom(14);
        }
      }
    };

    updateMarkers();
  }, [currentData.selectedOrders, currentData.orders, isLoaded, geocodeAddress, activeSection]);

  // Toggle order selection
  const toggleOrderSelection = (orderId) => {
    setSectionData(prev => {
      const current = prev[activeSection];
      const newSelected = current.selectedOrders.includes(orderId)
        ? current.selectedOrders.filter(id => id !== orderId)
        : [...current.selectedOrders, orderId];
      return {
        ...prev,
        [activeSection]: { ...current, selectedOrders: newSelected, directions: null, routeInfo: null }
      };
    });
  };

  // Build route
  const buildRoute = async () => {
    if (currentData.markers.length < 2) {
      toast.error('Выберите минимум 2 заказа для построения маршрута');
      return;
    }

    // Get selected orders with coordinates
    const ordersWithCoords = currentData.selectedOrders
      .map(id => currentData.orders.find(o => o.id === id))
      .filter(o => o && o.lat && o.lng);

    if (ordersWithCoords.length < 2) {
      toast.error('Нужно минимум 2 заказа с координатами на карте');
      return;
    }

    setBuildingRoute(true);
    try {
      const directionsService = new window.google.maps.DirectionsService();
      
      const origin = { lat: ordersWithCoords[0].lat, lng: ordersWithCoords[0].lng };
      const destination = { 
        lat: ordersWithCoords[ordersWithCoords.length - 1].lat, 
        lng: ordersWithCoords[ordersWithCoords.length - 1].lng 
      };
      const waypoints = ordersWithCoords.slice(1, -1).map(o => ({
        location: { lat: o.lat, lng: o.lng },
        stopover: true
      }));

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode.DRIVING
      });

      setSectionData(prev => ({
        ...prev,
        [activeSection]: {
          ...prev[activeSection],
          directions: result,
          routeInfo: {
            distance: result.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0),
            duration: result.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0)
          }
        }
      }));
    } catch (error) {
      console.error('Error building route:', error);
      toast.error('Ошибка построения маршрута');
    } finally {
      setBuildingRoute(false);
    }
  };

  // Clear route
  const clearRoute = () => {
    setSectionData(prev => ({
      ...prev,
      [activeSection]: {
        ...prev[activeSection],
        selectedOrders: [],
        directions: null,
        routeInfo: null
      }
    }));
  };

  // Get selected orders with coordinates
  const getSelectedOrdersWithCoords = () => {
    return currentData.selectedOrders
      .map(id => currentData.orders.find(o => o.id === id))
      .filter(o => o && o.lat && o.lng);
  };

  // Open route in Google Maps
  const openInGoogleMaps = () => {
    const ordersWithCoords = getSelectedOrdersWithCoords();
    if (ordersWithCoords.length < 2) return;

    const origin = ordersWithCoords[0];
    const destination = ordersWithCoords[ordersWithCoords.length - 1];
    const waypoints = ordersWithCoords.slice(1, -1).map(o => `${o.lat},${o.lng}`).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    url += '&travelmode=driving';

    window.open(url, '_blank');
  };

  // Create new order
  const handleCreateOrder = async () => {
    if (!newOrderForm.fullName || !newOrderForm.fullAddress) {
      toast.error('Заполните имя и адрес');
      return;
    }

    setCreatingOrder(true);
    try {
      const orderId = `LOG-${activeSection.toUpperCase()}-${Date.now()}`;
      const orderData = {
        id: orderId,
        fullName: newOrderForm.fullName,
        phoneNumber: newOrderForm.phoneNumber,
        fullAddress: newOrderForm.fullAddress,
        notes: newOrderForm.orderComposition,
        orderDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        source: 'logistics',
        status: 'new'
      };

      const response = await fetch(`${API_URL}${currentSection.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      toast.success('Заказ создан успешно');
      setShowOrderForm(false);
      setNewOrderForm({
        fullName: '',
        phoneNumber: '',
        fullAddress: '',
        orderComposition: ''
      });
      autocompleteRef.current = null;
      fetchAllOrders();
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Ошибка создания заказа');
    } finally {
      setCreatingOrder(false);
    }
  };

  // Delete order
  const deleteOrder = async (orderId) => {
    if (!window.confirm('Удалить этот заказ?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}${currentSection.endpoint}/${orderId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove from local state
        setSectionData(prev => ({
          ...prev,
          [activeSection]: {
            ...prev[activeSection],
            orders: prev[activeSection].orders.filter(o => o.id !== orderId),
            selectedOrders: prev[activeSection].selectedOrders.filter(id => id !== orderId)
          }
        }));
        toast.success('Заказ удалён');
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Ошибка удаления');
    }
  };

  // Update order fields (status, driver, route, comment)
  const updateOrderField = async (orderId, updates) => {
    try {
      const order = currentData.orders.find(o => o.id === orderId);
      if (!order) return;
      
      const updatedOrder = { ...order, ...updates };
      
      // Update in local state first for immediate feedback
      setSectionData(prev => ({
        ...prev,
        [activeSection]: {
          ...prev[activeSection],
          orders: prev[activeSection].orders.map(o => 
            o.id === orderId ? updatedOrder : o
          )
        }
      }));

      // Update in database
      const response = await fetch(`${API_URL}${currentSection.endpoint}/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      // Sync to amoCRM if order has amocrm_id and status changed
      if (order?.amocrm_id && updates.deliveryStatus) {
        try {
          const statusLabel = DELIVERY_STATUSES[updates.deliveryStatus]?.label || updates.deliveryStatus;
          const comment = updates.deliveryComment || order.deliveryComment || '';
          const syncResponse = await fetch(`${API_URL}/api/integrations/amocrm/sync-status?amocrm_id=${order.amocrm_id}&status=${encodeURIComponent(statusLabel)}&comment=${encodeURIComponent(comment)}`, {
            method: 'POST'
          });
          const syncResult = await syncResponse.json();
          if (syncResult.status === 'ok') {
            console.log('Status synced to amoCRM');
          } else if (syncResult.status === 'skipped') {
            console.log('amoCRM sync skipped:', syncResult.message);
          } else {
            console.warn('amoCRM sync error:', syncResult.message);
          }
        } catch (syncError) {
          console.error('Failed to sync to amoCRM:', syncError);
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      return false;
    }
  };

  // Legacy function for backward compatibility
  const updateDeliveryStatus = async (orderId, newStatus, deliveryComment = '') => {
    const success = await updateOrderField(orderId, { deliveryStatus: newStatus, deliveryComment });
    if (success) {
      toast.success('Статус обновлён');
    } else {
      toast.error('Ошибка обновления статуса');
      fetchAllOrders();
    }
  };

  // Bulk update selected orders
  const bulkUpdateOrders = async (updates) => {
    const selectedIds = currentData.selectedOrders;
    if (selectedIds.length === 0) {
      toast.error('Выберите заказы');
      return;
    }

    let successCount = 0;
    for (const orderId of selectedIds) {
      const success = await updateOrderField(orderId, updates);
      if (success) successCount++;
    }

    if (successCount > 0) {
      toast.success(`Обновлено ${successCount} из ${selectedIds.length} заказов`);
    } else {
      toast.error('Ошибка обновления');
      fetchAllOrders();
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Format duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}ч ${minutes}мин` : `${minutes}мин`;
  };

  // Format distance
  const formatDistance = (meters) => {
    return (meters / 1000).toFixed(1) + ' км';
  };

  if (loadError) {
    return (
      <Card className="m-6">
        <CardContent className="p-6">
          <p className="text-red-500">Ошибка загрузки Google Maps. Проверьте API ключ.</p>
        </CardContent>
      </Card>
    );
  }

  const SectionIcon = currentSection.icon;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Truck className="h-8 w-8 text-[#355c7d]" />
          <h1 className="text-2xl font-bold text-gray-900">Логистика</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline"
            onClick={() => setShowDriversModal(true)}
          >
            <Users className="h-4 w-4 mr-2" />
            Водители
          </Button>
          <Button 
            onClick={() => {
              setShowOrderForm(!showOrderForm);
              autocompleteRef.current = null;
            }}
            className="bg-[#355c7d] hover:bg-[#2a4a63]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать заказ
          </Button>
          <Button variant="outline" onClick={fetchAllOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Drivers Modal */}
      {showDriversModal && (
        <Card className="border-2 border-[#355c7d]/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Управление водителями
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowDriversModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newDriverName}
                onChange={(e) => setNewDriverName(e.target.value)}
                placeholder="Имя водителя"
                onKeyPress={(e) => e.key === 'Enter' && addDriver()}
              />
              <Button onClick={addDriver}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить
              </Button>
            </div>
            <div className="space-y-2">
              {drivers.map(driver => (
                <div key={driver.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {driver.name}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => removeDriver(driver.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              {drivers.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Нет водителей</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar - show when orders are selected */}
      {currentData.selectedOrders.length > 0 && (
        <Card className="border-2 border-amber-500/50 bg-amber-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  Выбрано: {currentData.selectedOrders.length}
                </Badge>
                <span className="text-sm text-muted-foreground">заказов</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Bulk Status */}
                <Select onValueChange={(status) => bulkUpdateOrders({ deliveryStatus: status })}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Статус" />
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

                {/* Bulk Driver */}
                <Select onValueChange={(driverId) => {
                  const driver = drivers.find(d => d.id === driverId);
                  if (driver) bulkUpdateOrders({ driverId, driverName: driver.name });
                }}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Водитель" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Не назначен</span>
                    </SelectItem>
                    {drivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {driver.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Bulk Route Number */}
                <Input
                  className="w-[120px] h-9"
                  placeholder="№ рейса"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      bulkUpdateOrders({ routeNumber: e.target.value });
                      e.target.value = '';
                    }
                  }}
                />

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearRoute}
                >
                  Сбросить выбор
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => { setActiveSection(v); }} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          {Object.entries(SECTIONS).map(([key, section]) => {
            const Icon = section.icon;
            const unassignedCount = getUnassignedOrders(sectionData[key].orders).length;
            const sectionTripsCount = trips.filter(t => t.section === key).length;
            return (
              <TabsTrigger 
                key={key} 
                value={key}
                className={`gap-2 data-[state=active]:${section.bgColor}`}
              >
                <Icon className={`h-4 w-4 ${section.color}`} />
                <span>{section.name.ru}</span>
                <Badge variant="secondary" className="ml-1">{unassignedCount}</Badge>
                {sectionTripsCount > 0 && (
                  <Badge variant="outline" className="ml-1 bg-purple-100 text-purple-700">{sectionTripsCount} рейс.</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.keys(SECTIONS).map(sectionKey => (
          <TabsContent key={sectionKey} value={sectionKey} className="mt-0">
            {/* Inner Tabs: Orders / Trips */}
            <div className="mb-4">
              <div className="flex gap-2 border-b">
                <button
                  onClick={() => setActiveInnerTab('orders')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeInnerTab === 'orders' 
                      ? `border-[#355c7d] text-[#355c7d]` 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Package className="h-4 w-4 inline mr-2" />
                  Заказы
                  <Badge variant="secondary" className="ml-2">{getUnassignedOrders(sectionData[sectionKey].orders).length}</Badge>
                </button>
                <button
                  onClick={() => setActiveInnerTab('trips')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeInnerTab === 'trips' 
                      ? 'border-purple-600 text-purple-600' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Route className="h-4 w-4 inline mr-2" />
                  Рейсы
                  <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700">
                    {trips.filter(t => t.section === sectionKey).length}
                  </Badge>
                </button>
              </div>
            </div>

            {/* Orders View */}
            {activeInnerTab === 'orders' && (
              <>
            {/* Create Order Form */}
            {showOrderForm && activeSection === sectionKey && (
              <Card className={`border-2 ${currentSection.borderColor}/30 ${currentSection.bgColor}/10 mb-6`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <SectionIcon className={`h-5 w-5 ${currentSection.color}`} />
                      Новый заказ - {currentSection.name.ru}
                    </CardTitle>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        setShowOrderForm(false);
                        autocompleteRef.current = null;
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Имя клиента *
                      </Label>
                      <Input
                        id="fullName"
                        value={newOrderForm.fullName}
                        onChange={(e) => setNewOrderForm(prev => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Введите имя"
                        data-testid="order-form-name"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        Телефон
                      </Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={newOrderForm.phoneNumber}
                        onChange={(e) => setNewOrderForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        placeholder="+48 123 456 789"
                        data-testid="order-form-phone"
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="fullAddress" className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Адрес доставки *
                      </Label>
                      <Input
                        ref={addressInputRef}
                        id="fullAddress"
                        value={newOrderForm.fullAddress}
                        onChange={(e) => setNewOrderForm(prev => ({ ...prev, fullAddress: e.target.value }))}
                        placeholder="Введите адрес..."
                        data-testid="order-form-address"
                      />
                    </div>

                    {/* Order Composition */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="orderComposition" className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Состав заказа
                      </Label>
                      <Textarea
                        id="orderComposition"
                        value={newOrderForm.orderComposition}
                        onChange={(e) => setNewOrderForm(prev => ({ ...prev, orderComposition: e.target.value }))}
                        placeholder="Опишите состав заказа..."
                        rows={3}
                        data-testid="order-form-composition"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="md:col-span-2 flex justify-end">
                      <Button
                        onClick={handleCreateOrder}
                        disabled={creatingOrder || !newOrderForm.fullName || !newOrderForm.fullAddress}
                        className="bg-[#355c7d] hover:bg-[#2a4a63]"
                        data-testid="order-form-submit"
                      >
                        {creatingOrder ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Создать заказ
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Orders List */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <SectionIcon className={`h-5 w-5 ${currentSection.color}`} />
                      {currentSection.name.ru} (без рейса)
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {currentData.selectedOrders.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => setShowCreateTripModal(true)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Создать рейс ({currentData.selectedOrders.length})
                        </Button>
                      )}
                      <Badge variant="secondary" className={currentSection.bgColor}>
                        {getUnassignedOrders(sectionData[sectionKey].orders).length} заказов
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : getUnassignedOrders(sectionData[sectionKey].orders).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Нет заказов без рейса
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {getUnassignedOrders(sectionData[sectionKey].orders).map((order) => (
                        <div
                          key={order.id}
                          className={`p-3 border rounded-lg transition-colors ${
                            sectionData[sectionKey].selectedOrders.includes(order.id)
                              ? `${currentSection.bgColor} ${currentSection.borderColor}`
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={sectionData[sectionKey].selectedOrders.includes(order.id)}
                              onCheckedChange={() => toggleOrderSelection(order.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium truncate">
                                  {order.fullName || order.customerName}
                                </p>
                                <div className="flex items-center gap-1">
                                  {/* Delivery Status Badge */}
                                  {(() => {
                                    const status = DELIVERY_STATUSES[order.deliveryStatus] || DELIVERY_STATUSES.pending;
                                    const StatusIcon = status.icon;
                                    return (
                                      <Badge className={`${status.color} text-xs gap-1`}>
                                        <StatusIcon className="h-3 w-3" />
                                        {status.label}
                                      </Badge>
                                    );
                                  })()}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                  >
                                    {expandedOrder === order.id ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteOrder(order.id)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{order.fullAddress || order.address || 'Нет адреса'}</span>
                                {/* Map indicator */}
                                {(order.lat && order.lng) ? (
                                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 whitespace-nowrap">
                                    ✓ на карте
                                  </span>
                                ) : (order.fullAddress || order.address) ? (
                                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 whitespace-nowrap">
                                    ⏳ геокодинг
                                  </span>
                                ) : (
                                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">
                                    нет адреса
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
                              
                              {expandedOrder === order.id && (
                                <div className="mt-3 pt-3 border-t space-y-3 text-sm">
                                  {order.phoneNumber && (
                                    <p className="flex items-center gap-2">
                                      <Phone className="h-3 w-3" />
                                      {order.phoneNumber}
                                    </p>
                                  )}
                                  {order.notes && (
                                    <p className="flex items-start gap-2">
                                      <FileText className="h-3 w-3 mt-0.5" />
                                      <span className="break-words">{order.notes}</span>
                                    </p>
                                  )}
                                  
                                  {/* Route & Driver */}
                                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">№ рейса</Label>
                                      <Input
                                        placeholder="Номер"
                                        defaultValue={order.routeNumber || ''}
                                        className="h-8 text-xs"
                                        onBlur={(e) => {
                                          if (e.target.value !== (order.routeNumber || '')) {
                                            updateOrderField(order.id, { routeNumber: e.target.value });
                                            toast.success('Рейс обновлён');
                                          }
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Водитель</Label>
                                      <Select
                                        value={order.driverId || 'none'}
                                        onValueChange={(value) => {
                                          const driver = drivers.find(d => d.id === value);
                                          updateOrderField(order.id, { 
                                            driverId: value === 'none' ? '' : value, 
                                            driverName: driver?.name || '' 
                                          });
                                          toast.success('Водитель назначен');
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Выбрать" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">Не назначен</SelectItem>
                                          {drivers.map(driver => (
                                            <SelectItem key={driver.id} value={driver.id}>
                                              {driver.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  
                                  {/* Status Change */}
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Статус доставки</Label>
                                    <Select
                                      value={order.deliveryStatus || 'pending'}
                                      onValueChange={(value) => updateDeliveryStatus(order.id, value, order.deliveryComment || '')}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
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
                                          updateDeliveryStatus(order.id, order.deliveryStatus || 'pending', e.target.value);
                                        }
                                      }}
                                    />
                                    
                                    {order.amocrm_id && (
                                      <p className="text-xs text-purple-500 flex items-center gap-1">
                                        <Send className="h-3 w-3" />
                                        Синхр. с amoCRM при изменении
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Map */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Карта
                    </CardTitle>
                    <div className="flex gap-2">
                      {sectionData[sectionKey].selectedOrders.length > 0 && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={clearRoute}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Сбросить
                          </Button>
                          <Button
                            size="sm"
                            onClick={buildRoute}
                            disabled={buildingRoute || sectionData[sectionKey].selectedOrders.filter(id => {
                              const order = sectionData[sectionKey].orders.find(o => o.id === id);
                              return order && order.lat && order.lng;
                            }).length < 2}
                            className={`${currentSection.bgColor} ${currentSection.color} hover:opacity-90`}
                          >
                            {buildingRoute ? (
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Route className="h-4 w-4 mr-1" />
                            )}
                            Построить маршрут
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Route Info */}
                  {sectionData[sectionKey].routeInfo && (
                    <div className={`flex gap-4 mt-3 p-3 ${currentSection.bgColor}/50 rounded-lg`}>
                      <div className="flex items-center gap-2">
                        <Navigation className={`h-4 w-4 ${currentSection.color}`} />
                        <span className="text-sm font-medium">
                          {formatDistance(sectionData[sectionKey].routeInfo.distance)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className={`h-4 w-4 ${currentSection.color}`} />
                        <span className="text-sm font-medium">
                          {formatDuration(sectionData[sectionKey].routeInfo.duration)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={openInGoogleMaps}
                        className="ml-auto"
                      >
                        <Navigation className="h-4 w-4 mr-1" />
                        Открыть в Google Maps
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {!isLoaded ? (
                    <div className="flex items-center justify-center h-[500px] bg-muted rounded-lg">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
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
                      {/* All orders with coordinates */}
                      {sectionData[sectionKey].orders
                        .filter(order => order.lat && order.lng)
                        .map((order) => {
                          const isSelected = sectionData[sectionKey].selectedOrders.includes(order.id);
                          const selectedIndex = isSelected 
                            ? sectionData[sectionKey].selectedOrders.indexOf(order.id) + 1 
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
                              icon={{
                                path: window.google.maps.SymbolPath.CIRCLE,
                                scale: isSelected ? 14 : 8,
                                fillColor: isSelected ? currentSection.markerColor : '#9ca3af',
                                fillOpacity: isSelected ? 1 : 0.7,
                                strokeColor: isSelected ? 'white' : '#6b7280',
                                strokeWeight: isSelected ? 2 : 1
                              }}
                              onClick={() => {
                                // Toggle selection on click
                                const currentSelected = sectionData[sectionKey].selectedOrders;
                                if (isSelected) {
                                  setSectionData(prev => ({
                                    ...prev,
                                    [sectionKey]: {
                                      ...prev[sectionKey],
                                      selectedOrders: currentSelected.filter(id => id !== order.id)
                                    }
                                  }));
                                } else {
                                  setSectionData(prev => ({
                                    ...prev,
                                    [sectionKey]: {
                                      ...prev[sectionKey],
                                      selectedOrders: [...currentSelected, order.id]
                                    }
                                  }));
                                }
                              }}
                            />
                          );
                        })}
                      
                      {sectionData[sectionKey].directions && (
                        <DirectionsRenderer
                          directions={sectionData[sectionKey].directions}
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
                  )}
                </CardContent>
              </Card>
            </div>
              </>
            )}

            {/* Trips View */}
            {activeInnerTab === 'trips' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trips List for this section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Route className="h-5 w-5 text-purple-600" />
                        Рейсы — {SECTIONS[sectionKey].name.ru}
                      </CardTitle>
                      <Badge variant="secondary" className="bg-purple-100">
                        {trips.filter(t => t.section === sectionKey).length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {trips.filter(t => t.section === sectionKey).length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">
                          Нет рейсов для этой категории
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => setActiveInnerTab('orders')}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Перейти к заказам
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {trips.filter(t => t.section === sectionKey).map((trip) => (
                          <div
                            key={trip.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedTrip?.id === trip.id ? 'bg-purple-50 border-purple-300' : 'hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedTrip(trip)}
                            data-testid={`trip-card-${trip.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{trip.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {trip.orderIds?.length || 0} заказов
                                </p>
                                {trip.driverName && (
                                  <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
                                    <User className="h-3 w-3" />
                                    {trip.driverName}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={
                                  trip.status === 'completed' ? 'bg-green-100 text-green-700' : 
                                  trip.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'
                                }>
                                  {trip.status === 'completed' ? 'Доставлен' : 
                                   trip.status === 'cancelled' ? 'Отменён' : 'Активен'}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id); }}
                                  className="text-red-500 hover:text-red-700"
                                  data-testid={`delete-trip-${trip.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Selected Trip Details */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      {selectedTrip ? selectedTrip.name : 'Выберите рейс'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedTrip && selectedTrip.section === sectionKey ? (
                      <div className="space-y-4">
                        {/* Driver assignment */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Водитель:</Label>
                          <Select
                            value={selectedTrip.driverId || 'none'}
                            onValueChange={(value) => {
                              const driver = drivers.find(d => d.id === value);
                              updateTrip(selectedTrip.id, {
                                driverId: value === 'none' ? null : value,
                                driverName: driver?.name || null
                              });
                              // Update local state immediately
                              setSelectedTrip(prev => ({
                                ...prev,
                                driverId: value === 'none' ? null : value,
                                driverName: driver?.name || null
                              }));
                            }}
                          >
                            <SelectTrigger className="w-full" data-testid="trip-driver-select">
                              <SelectValue placeholder="Выберите водителя" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Не назначен</SelectItem>
                              {drivers.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Статус:</Label>
                          <Select
                            value={selectedTrip.status || 'active'}
                            onValueChange={(value) => {
                              updateTrip(selectedTrip.id, { status: value });
                              setSelectedTrip(prev => ({ ...prev, status: value }));
                            }}
                          >
                            <SelectTrigger className="w-full" data-testid="trip-status-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Активен</SelectItem>
                              <SelectItem value="completed">Доставлен</SelectItem>
                              <SelectItem value="cancelled">Отменён</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Orders in trip */}
                        <div className="border-t pt-4">
                          <p className="text-sm font-medium mb-2">Заказы в рейсе ({selectedTrip.orderIds?.length || 0}):</p>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {selectedTrip.orderIds?.map(orderId => {
                              const order = sectionData[selectedTrip.section]?.orders.find(o => o.id === orderId);
                              return order ? (
                                <div key={orderId} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{order.fullName || order.customerName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{order.fullAddress || order.address}</p>
                                    {order.phoneNumber && (
                                      <p className="text-xs text-muted-foreground">{order.phoneNumber}</p>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeOrderFromTrip(selectedTrip.id, orderId)}
                                    className="text-red-500 hover:text-red-700 flex-shrink-0"
                                    title="Убрать из рейса"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div key={orderId} className="p-2 bg-muted rounded text-xs text-muted-foreground">
                                  Заказ {orderId} не найден
                                </div>
                              );
                            })}
                            {(!selectedTrip.orderIds || selectedTrip.orderIds.length === 0) && (
                              <p className="text-center text-muted-foreground py-4 text-sm">
                                В рейсе нет заказов
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Delete Trip Button */}
                        <div className="border-t pt-4">
                          <Button
                            variant="outline"
                            className="w-full text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => deleteTrip(selectedTrip.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Удалить рейс
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Выберите рейс слева для просмотра деталей
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Trip Modal */}
      {showCreateTripModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5 text-purple-600" />
                Создать рейс — {currentSection.name.ru}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Название рейса *</Label>
                <Input
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  placeholder="Например: Рейс 15 января"
                  data-testid="trip-name-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Водитель</Label>
                <Select
                  value={newTripDriver}
                  onValueChange={setNewTripDriver}
                >
                  <SelectTrigger data-testid="trip-driver-input">
                    <SelectValue placeholder="Выберите водителя (опционально)" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Выбранные заказы: {currentData.selectedOrders.length}</p>
                <div className="max-h-[150px] overflow-y-auto space-y-1">
                  {currentData.selectedOrders.map(orderId => {
                    const order = currentData.orders.find(o => o.id === orderId);
                    return order ? (
                      <p key={orderId} className="text-xs text-muted-foreground truncate">
                        • {order.fullName || order.customerName} — {order.fullAddress || order.address || 'без адреса'}
                      </p>
                    ) : null;
                  })}
                </div>
              </div>
              
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => {
                  setShowCreateTripModal(false);
                  setNewTripName('');
                  setNewTripDriver('');
                }}>
                  Отмена
                </Button>
                <Button 
                  onClick={createTrip}
                  disabled={creatingTrip || !newTripName.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="create-trip-submit"
                >
                  {creatingTrip ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Создать рейс
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
