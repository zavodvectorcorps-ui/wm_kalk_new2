import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { 
  MapPin, Route, RefreshCw, Package, Plus, User, Settings, Warehouse
} from 'lucide-react';

// Import refactored components
import {
  API_URL, GOOGLE_MAPS_API_KEY, libraries, SECTIONS, TRIP_STATUSES,
  DEFAULT_DRIVERS, getUnassignedOrders, formatDate
} from './logistics/constants';
import OrdersMap from './logistics/OrdersMap';
import OrdersList from './logistics/OrdersList';
import TripsList from './logistics/TripsList';
import TripDetails, { TripMap } from './logistics/TripDetails';
import { 
  CreateTripModal, DriversModal, SettingsModal, CreateOrderModal 
} from './logistics/LogisticsModals';

const LogisticsPage = () => {
  // Section state
  const [activeSection, setActiveSection] = useState('balia');
  const [activeInnerTab, setActiveInnerTab] = useState('orders');
  
  // Data state per section
  const [sectionData, setSectionData] = useState({
    greenhouse: { orders: [], selectedOrders: [], markers: [], directions: null, routeInfo: null },
    balia: { orders: [], selectedOrders: [], markers: [], directions: null, routeInfo: null },
    sauna: { orders: [], selectedOrders: [], markers: [], directions: null, routeInfo: null }
  });
  
  const [loading, setLoading] = useState(true);
  const [buildingRoute, setBuildingRoute] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  
  // Trips state
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripDriver, setNewTripDriver] = useState('');
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [optimizingRoute, setOptimizingRoute] = useState(false);
  const [draggedOrderIndex, setDraggedOrderIndex] = useState(null);
  
  // Drivers state
  const [drivers, setDrivers] = useState(DEFAULT_DRIVERS);
  const [showDriversModal, setShowDriversModal] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  
  // Map state
  const [mapFilter, setMapFilter] = useState('free');
  const [tripStatusFilter, setTripStatusFilter] = useState('planned');
  
  // Order form state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    fullName: '', phoneNumber: '', fullAddress: '', orderComposition: ''
  });
  const [creatingOrder, setCreatingOrder] = useState(false);
  
  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [warehouseCoords, setWarehouseCoords] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Trip route state
  const [tripDirections, setTripDirections] = useState(null);
  const [tripRouteInfo, setTripRouteInfo] = useState(null);
  const [buildingTripRoute, setBuildingTripRoute] = useState(false);
  
  // Refs
  const mapRef = useRef(null);
  const tripMapRef = useRef(null);
  const geocoderRef = useRef(null);
  const addressInputRef = useRef(null);
  const warehouseInputRef = useRef(null);
  
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries
  });
  
  const currentData = sectionData[activeSection];
  const currentSection = SECTIONS[activeSection];

  // Load drivers from API
  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/drivers`);
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);
      }
    } catch (e) {
      console.error('Failed to load drivers:', e);
    }
  }, []);

  // Load warehouse settings
  useEffect(() => {
    const saved = localStorage.getItem('warehouse_address');
    const savedCoords = localStorage.getItem('warehouse_coords');
    if (saved) setWarehouseAddress(saved);
    if (savedCoords) {
      try {
        setWarehouseCoords(JSON.parse(savedCoords));
      } catch (e) {}
    }
    fetchDrivers();
  }, [fetchDrivers]);

  // Save warehouse settings
  const saveWarehouseSettings = async () => {
    if (!warehouseAddress.trim()) {
      toast.error('Введите адрес склада');
      return;
    }
    
    setSavingSettings(true);
    try {
      if (geocoderRef.current) {
        geocoderRef.current.geocode({ address: warehouseAddress }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const coords = {
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng()
            };
            setWarehouseCoords(coords);
            localStorage.setItem('warehouse_address', warehouseAddress);
            localStorage.setItem('warehouse_coords', JSON.stringify(coords));
            toast.success('Адрес склада сохранён');
            setShowSettingsModal(false);
          } else {
            toast.error('Не удалось определить координаты адреса');
          }
          setSavingSettings(false);
        });
      }
    } catch (error) {
      console.error('Error saving warehouse:', error);
      toast.error('Ошибка сохранения');
      setSavingSettings(false);
    }
  };

  // Driver management
  const addDriver = async () => {
    if (!newDriverName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDriverName.trim() })
      });
      if (res.ok) {
        const newDriver = await res.json();
        setDrivers(prev => [...prev, newDriver]);
        setNewDriverName('');
        toast.success('Водитель добавлен');
      }
    } catch (e) {
      console.error('Failed to add driver:', e);
      toast.error('Ошибка добавления водителя');
    }
  };

  const removeDriver = async (driverId) => {
    try {
      const res = await fetch(`${API_URL}/api/drivers/${driverId}`, { method: 'DELETE' });
      if (res.ok) {
        setDrivers(prev => prev.filter(d => d.id !== driverId));
        toast.success('Водитель удалён');
      }
    } catch (e) {
      console.error('Failed to remove driver:', e);
      toast.error('Ошибка удаления водителя');
    }
  };

  // Fetch orders for section
  const fetchSectionOrders = useCallback(async (sectionId) => {
    const section = SECTIONS[sectionId];
    try {
      const res = await fetch(`${API_URL}${section.endpoint}`);
      if (res.ok) {
        const allOrders = await res.json();
        const orders = allOrders
          .filter(o => o.amocrm_id || o.source === 'amocrm')
          .map(o => ({ ...o, orderType: sectionId }))
          .sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt));
        return orders;
      }
      return [];
    } catch (error) {
      console.error(`Error fetching ${sectionId} orders:`, error);
      return [];
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
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  }, [fetchSectionOrders]);

  // Fetch trips
  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/trips`);
      if (res.ok) {
        const data = await res.json();
        setTrips(data);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAllOrders();
    fetchTrips();
  }, [fetchAllOrders, fetchTrips]);

  // Initialize geocoder
  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
  }, [isLoaded]);

  // Create trip
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
        fetchAllOrders();
        fetchTrips();
        setSectionData(prev => ({
          ...prev,
          [activeSection]: { ...prev[activeSection], selectedOrders: [] }
        }));
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

  // Update trip
  const updateTrip = async (tripId, updates) => {
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
        if (selectedTrip?.id === tripId) {
          setSelectedTrip(updated);
        }
        toast.success('Рейс обновлён');
      }
    } catch (error) {
      console.error('Error updating trip:', error);
      toast.error('Ошибка обновления рейса');
    }
  };

  // Delete trip
  const deleteTrip = async (tripId) => {
    if (!window.confirm('Удалить рейс?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, { method: 'DELETE' });
      if (res.ok) {
        setTrips(prev => prev.filter(t => t.id !== tripId));
        if (selectedTrip?.id === tripId) {
          setSelectedTrip(null);
        }
        fetchAllOrders();
        toast.success('Рейс удалён');
      }
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error('Ошибка удаления рейса');
    }
  };

  // Update order status in trip
  const updateOrderStatusInTrip = async (tripId, orderId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}/order-status/${orderId}?status=${newStatus}`, {
        method: 'PUT'
      });
      if (res.ok) {
        const updated = await res.json();
        setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
        if (selectedTrip?.id === tripId) {
          setSelectedTrip(updated);
        }
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Ошибка обновления статуса');
    }
  };

  // Remove order from trip
  const removeOrderFromTrip = async (tripId, orderId) => {
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}/remove-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [orderId] })
      });
      if (res.ok) {
        const updated = await res.json();
        setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
        if (selectedTrip?.id === tripId) {
          setSelectedTrip(updated);
        }
        fetchAllOrders();
        toast.success('Заказ убран из рейса');
      }
    } catch (error) {
      console.error('Error removing order:', error);
      toast.error('Ошибка');
    }
  };

  // Toggle order selection
  const toggleOrderSelection = (orderId) => {
    setSectionData(prev => {
      const isSelected = prev[activeSection].selectedOrders.includes(orderId);
      return {
        ...prev,
        [activeSection]: {
          ...prev[activeSection],
          selectedOrders: isSelected 
            ? prev[activeSection].selectedOrders.filter(id => id !== orderId)
            : [...prev[activeSection].selectedOrders, orderId]
        }
      };
    });
  };

  // Toggle important flag
  const toggleOrderImportant = async (orderId) => {
    const order = currentData.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const newImportant = !order.isImportant;
    const section = order.orderType || activeSection;
    
    try {
      const res = await fetch(`${API_URL}/api/orders/${section}/${orderId}/toggle_important`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_important: newImportant })
      });
      
      if (res.ok) {
        setSectionData(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            orders: prev[section].orders.map(o => 
              o.id === orderId ? { ...o, isImportant: newImportant } : o
            )
          }
        }));
        toast.success(newImportant ? 'Заказ отмечен как важный' : 'Отметка важности снята');
      }
    } catch (error) {
      console.error('Error toggling important:', error);
      toast.error('Ошибка');
    }
  };

  // Update delivery status
  const updateDeliveryStatus = async (orderId, status, comment = null) => {
    const order = currentData.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const section = order.orderType || activeSection;
    const sectionConfig = SECTIONS[section];
    
    try {
      const res = await fetch(`${API_URL}${sectionConfig.endpoint}/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deliveryStatus: status,
          ...(comment !== null && { deliveryComment: comment })
        })
      });
      
      if (res.ok) {
        setSectionData(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            orders: prev[section].orders.map(o => 
              o.id === orderId ? { 
                ...o, 
                deliveryStatus: status,
                ...(comment !== null && { deliveryComment: comment })
              } : o
            )
          }
        }));
        toast.success('Статус обновлён');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Ошибка');
    }
  };

  // Update order field
  const updateOrderField = async (orderId, updates) => {
    const order = currentData.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const section = order.orderType || activeSection;
    const sectionConfig = SECTIONS[section];
    
    try {
      const res = await fetch(`${API_URL}${sectionConfig.endpoint}/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (res.ok) {
        setSectionData(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            orders: prev[section].orders.map(o => 
              o.id === orderId ? { ...o, ...updates } : o
            )
          }
        }));
      }
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  // Build route
  const buildRoute = async () => {
    if (currentData.selectedOrders.length < 2) {
      toast.error('Выберите минимум 2 заказа для построения маршрута');
      return;
    }

    setBuildingRoute(true);
    try {
      const ordersWithCoords = currentData.selectedOrders
        .map(id => currentData.orders.find(o => o.id === id))
        .filter(o => o && o.lat && o.lng);

      if (ordersWithCoords.length < 2) {
        toast.error('Недостаточно заказов с координатами');
        setBuildingRoute(false);
        return;
      }

      const directionsService = new window.google.maps.DirectionsService();
      const origin = { lat: ordersWithCoords[0].lat, lng: ordersWithCoords[0].lng };
      const destination = { lat: ordersWithCoords[ordersWithCoords.length - 1].lat, lng: ordersWithCoords[ordersWithCoords.length - 1].lng };
      const waypoints = ordersWithCoords.slice(1, -1).map(o => ({
        location: { lat: o.lat, lng: o.lng },
        stopover: true
      }));

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING
      });

      const route = result.routes[0];
      let totalDistance = 0;
      let totalDuration = 0;
      route.legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      setSectionData(prev => ({
        ...prev,
        [activeSection]: {
          ...prev[activeSection],
          directions: result,
          routeInfo: { distance: totalDistance, duration: totalDuration }
        }
      }));
    } catch (error) {
      console.error('Error building route:', error);
      toast.error('Ошибка построения маршрута');
    } finally {
      setBuildingRoute(false);
    }
  };

  // Optimize trip route
  const optimizeTripRoute = async () => {
    if (!selectedTrip || !selectedTrip.orderIds || selectedTrip.orderIds.length < 1) {
      toast.error('Добавьте заказы в рейс');
      return;
    }

    const ordersWithCoords = selectedTrip.orderIds
      .map(id => sectionData[selectedTrip.section]?.orders.find(o => o.id === id))
      .filter(o => o && o.lat && o.lng);

    if (ordersWithCoords.length < 1) {
      toast.error('Нужен минимум 1 заказ с координатами');
      return;
    }

    const useWarehouse = warehouseCoords && warehouseCoords.lat && warehouseCoords.lng;
    
    if (!useWarehouse && ordersWithCoords.length < 2) {
      toast.error('Укажите адрес склада или добавьте минимум 2 заказа');
      return;
    }

    setOptimizingRoute(true);
    try {
      const directionsService = new window.google.maps.DirectionsService();
      
      const origin = useWarehouse 
        ? { lat: warehouseCoords.lat, lng: warehouseCoords.lng }
        : { lat: ordersWithCoords[0].lat, lng: ordersWithCoords[0].lng };
      const destination = useWarehouse 
        ? { lat: warehouseCoords.lat, lng: warehouseCoords.lng }
        : { lat: ordersWithCoords[ordersWithCoords.length - 1].lat, lng: ordersWithCoords[ordersWithCoords.length - 1].lng };
      
      let waypoints;
      if (useWarehouse) {
        waypoints = ordersWithCoords.map(o => ({
          location: { lat: o.lat, lng: o.lng },
          stopover: true
        }));
      } else {
        waypoints = ordersWithCoords.slice(1, -1).map(o => ({
          location: { lat: o.lat, lng: o.lng },
          stopover: true
        }));
      }

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode.DRIVING
      });

      const waypointOrder = result.routes[0].waypoint_order;
      
      let newOrderIds;
      if (useWarehouse) {
        newOrderIds = waypointOrder.map(i => ordersWithCoords[i].id);
      } else {
        const middleOrders = ordersWithCoords.slice(1, -1);
        const optimizedMiddle = waypointOrder.map(i => middleOrders[i]);
        newOrderIds = [
          ordersWithCoords[0].id,
          ...optimizedMiddle.map(o => o.id),
          ordersWithCoords[ordersWithCoords.length - 1].id
        ];
      }

      // Update trip
      await updateTrip(selectedTrip.id, { orderIds: newOrderIds });
      
      // Calculate route info
      const route = result.routes[0];
      let totalDistance = 0;
      let totalDuration = 0;
      route.legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      setTripDirections(result);
      setTripRouteInfo({ distance: totalDistance, duration: totalDuration });
      
      toast.success('Маршрут оптимизирован');
    } catch (error) {
      console.error('Error optimizing route:', error);
      toast.error('Ошибка оптимизации маршрута');
    } finally {
      setOptimizingRoute(false);
    }
  };

  // Build trip route
  const buildTripRoute = async () => {
    if (!selectedTrip) return;

    const ordersWithCoords = selectedTrip.orderIds
      ?.map(id => sectionData[selectedTrip.section]?.orders.find(o => o.id === id))
      .filter(o => o && o.lat && o.lng) || [];

    if (ordersWithCoords.length < 1) {
      toast.error('Нет заказов с координатами');
      return;
    }

    setBuildingTripRoute(true);
    try {
      const directionsService = new window.google.maps.DirectionsService();
      const useWarehouse = warehouseCoords?.lat && warehouseCoords?.lng;
      
      const origin = useWarehouse ? warehouseCoords : { lat: ordersWithCoords[0].lat, lng: ordersWithCoords[0].lng };
      const destination = useWarehouse ? warehouseCoords : { lat: ordersWithCoords[ordersWithCoords.length - 1].lat, lng: ordersWithCoords[ordersWithCoords.length - 1].lng };
      
      const waypoints = useWarehouse 
        ? ordersWithCoords.map(o => ({ location: { lat: o.lat, lng: o.lng }, stopover: true }))
        : ordersWithCoords.slice(1, -1).map(o => ({ location: { lat: o.lat, lng: o.lng }, stopover: true }));

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING
      });

      const route = result.routes[0];
      let totalDistance = 0;
      let totalDuration = 0;
      route.legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      setTripDirections(result);
      setTripRouteInfo({ distance: totalDistance, duration: totalDuration });
    } catch (error) {
      console.error('Error building trip route:', error);
      toast.error('Ошибка построения маршрута');
    } finally {
      setBuildingTripRoute(false);
    }
  };

  // Move order in trip
  const moveOrderInTrip = (direction, index) => {
    if (!selectedTrip) return;
    
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedTrip.orderIds.length) return;
    
    const newOrderIds = [...selectedTrip.orderIds];
    [newOrderIds[index], newOrderIds[newIndex]] = [newOrderIds[newIndex], newOrderIds[index]];
    
    updateTrip(selectedTrip.id, { orderIds: newOrderIds });
  };

  // Drag handlers
  const handleDragStart = (index) => setDraggedOrderIndex(index);
  const handleDragEnd = () => setDraggedOrderIndex(null);
  const handleDragOver = (e) => e.preventDefault();
  
  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedOrderIndex === null || !selectedTrip) return;
    
    const newOrderIds = [...selectedTrip.orderIds];
    const [removed] = newOrderIds.splice(draggedOrderIndex, 1);
    newOrderIds.splice(targetIndex, 0, removed);
    
    updateTrip(selectedTrip.id, { orderIds: newOrderIds });
    setDraggedOrderIndex(null);
  };

  // Map load handlers
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    if (!geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
  }, []);

  const onTripMapLoad = useCallback((map) => {
    tripMapRef.current = map;
  }, []);

  // Handle marker click on map
  const handleMarkerClick = (order) => {
    toggleOrderSelection(order.id);
  };

  // Create order
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
        source: 'logistics',
        amocrm_id: null
      };

      // Geocode address
      if (geocoderRef.current) {
        geocoderRef.current.geocode({ address: newOrderForm.fullAddress }, async (results, status) => {
          if (status === 'OK' && results[0]) {
            orderData.lat = results[0].geometry.location.lat();
            orderData.lng = results[0].geometry.location.lng();
          }

          const sectionConfig = SECTIONS[activeSection];
          const res = await fetch(`${API_URL}${sectionConfig.endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
          });

          if (res.ok) {
            toast.success('Заказ создан');
            setShowOrderForm(false);
            setNewOrderForm({ fullName: '', phoneNumber: '', fullAddress: '', orderComposition: '' });
            fetchAllOrders();
          } else {
            throw new Error('Failed to create order');
          }
          setCreatingOrder(false);
        });
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Ошибка создания заказа');
      setCreatingOrder(false);
    }
  };

  // Clear trip route when trip changes
  useEffect(() => {
    setTripDirections(null);
    setTripRouteInfo(null);
  }, [selectedTrip?.id]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Логистика
          </h1>
          <p className="text-muted-foreground">
            Управление доставками и маршрутами
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDriversModal(true)}>
            <User className="h-4 w-4 mr-1" />
            Водители
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettingsModal(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Настройки
          </Button>
          <Button size="sm" onClick={() => setShowOrderForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Новый заказ
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          {Object.entries(SECTIONS).map(([key, section]) => {
            const Icon = section.icon;
            const sectionTripsCount = trips.filter(t => t.section === key).length;
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-1">
                <Icon className={`h-4 w-4 ${section.color}`} />
                <span className="hidden sm:inline">{section.name}</span>
                {sectionTripsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                    {sectionTripsCount}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.keys(SECTIONS).map(sectionKey => (
          <TabsContent key={sectionKey} value={sectionKey} className="mt-4">
            {/* Inner tabs: Orders / Trips */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={activeInnerTab === 'orders' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveInnerTab('orders')}
              >
                <Package className="h-4 w-4 mr-1" />
                Заказы
                <Badge variant="secondary" className="ml-2">
                  {getUnassignedOrders(sectionData[sectionKey].orders).length}
                </Badge>
              </Button>
              <Button
                variant={activeInnerTab === 'trips' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveInnerTab('trips')}
              >
                <Route className="h-4 w-4 mr-1" />
                Рейсы
                <Badge variant="secondary" className="ml-2">
                  {trips.filter(t => t.section === sectionKey).length}
                </Badge>
              </Button>
            </div>

            {activeInnerTab === 'orders' ? (
              /* Orders Tab */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {/* Create trip button */}
                  {sectionData[sectionKey].selectedOrders.length > 0 && (
                    <Button onClick={() => setShowCreateTripModal(true)} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Создать рейс ({sectionData[sectionKey].selectedOrders.length} заказов)
                    </Button>
                  )}
                  
                  <OrdersList
                    orders={sectionData[sectionKey].orders}
                    selectedOrders={sectionData[sectionKey].selectedOrders}
                    expandedOrder={expandedOrder}
                    onSelectOrder={toggleOrderSelection}
                    onToggleExpand={setExpandedOrder}
                    onToggleImportant={toggleOrderImportant}
                    onUpdateDeliveryStatus={updateDeliveryStatus}
                    onUpdateOrderField={updateOrderField}
                    loading={loading}
                  />
                </div>
                
                <OrdersMap
                  isLoaded={isLoaded}
                  sectionData={sectionData}
                  sectionKey={sectionKey}
                  currentSection={SECTIONS[sectionKey]}
                  mapFilter={mapFilter}
                  setMapFilter={setMapFilter}
                  onMapLoad={onMapLoad}
                  warehouseCoords={warehouseCoords}
                  buildingRoute={buildingRoute}
                  onBuildRoute={buildRoute}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            ) : (
              /* Trips Tab */
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
                {/* Trip List */}
                <div className="lg:col-span-3">
                  <TripsList
                    trips={trips}
                    sectionKey={sectionKey}
                    tripStatusFilter={tripStatusFilter}
                    setTripStatusFilter={setTripStatusFilter}
                    selectedTrip={selectedTrip}
                    setSelectedTrip={setSelectedTrip}
                    setActiveInnerTab={setActiveInnerTab}
                  />
                </div>

                {/* Trip Details */}
                <div className="lg:col-span-4">
                  <TripDetails
                    selectedTrip={selectedTrip}
                    orders={sectionData[sectionKey].orders}
                    drivers={drivers}
                    isLoaded={isLoaded}
                    warehouseCoords={warehouseCoords}
                    tripDirections={tripDirections}
                    tripRouteInfo={tripRouteInfo}
                    buildingTripRoute={buildingTripRoute}
                    optimizingRoute={optimizingRoute}
                    draggedOrderIndex={draggedOrderIndex}
                    onTripMapLoad={onTripMapLoad}
                    onUpdateTrip={updateTrip}
                    onDeleteTrip={() => deleteTrip(selectedTrip?.id)}
                    onOptimizeRoute={optimizeTripRoute}
                    onBuildTripRoute={buildTripRoute}
                    onUpdateOrderStatus={updateOrderStatusInTrip}
                    onRemoveOrderFromTrip={removeOrderFromTrip}
                    onMoveOrderInTrip={moveOrderInTrip}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                </div>

                {/* Trip Map */}
                <div className="lg:col-span-3">
                  <TripMap
                    isLoaded={isLoaded}
                    selectedTrip={selectedTrip}
                    orders={sectionData[sectionKey].orders}
                    warehouseCoords={warehouseCoords}
                    tripDirections={tripDirections}
                    currentSection={SECTIONS[sectionKey]}
                    onTripMapLoad={onTripMapLoad}
                    onBuildTripRoute={buildTripRoute}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Modals */}
      <CreateTripModal
        show={showCreateTripModal}
        onClose={() => setShowCreateTripModal(false)}
        tripName={newTripName}
        setTripName={setNewTripName}
        tripDriver={newTripDriver}
        setTripDriver={setNewTripDriver}
        drivers={drivers}
        selectedOrdersCount={currentData.selectedOrders.length}
        creating={creatingTrip}
        onCreate={createTrip}
      />
      
      <DriversModal
        show={showDriversModal}
        onClose={() => setShowDriversModal(false)}
        drivers={drivers}
        newDriverName={newDriverName}
        setNewDriverName={setNewDriverName}
        onAddDriver={addDriver}
        onRemoveDriver={removeDriver}
      />
      
      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        warehouseAddress={warehouseAddress}
        setWarehouseAddress={setWarehouseAddress}
        warehouseInputRef={warehouseInputRef}
        saving={savingSettings}
        onSave={saveWarehouseSettings}
      />
      
      <CreateOrderModal
        show={showOrderForm}
        onClose={() => setShowOrderForm(false)}
        form={newOrderForm}
        setForm={setNewOrderForm}
        addressInputRef={addressInputRef}
        creating={creatingOrder}
        onCreate={handleCreateOrder}
      />
    </div>
  );
};

export default LogisticsPage;
