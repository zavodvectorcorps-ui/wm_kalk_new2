import { useState, useEffect, useCallback, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'sonner';
import { 
  API_URL, 
  GOOGLE_MAPS_API_KEY, 
  libraries, 
  SECTIONS, 
  DEFAULT_DRIVERS,
  DELIVERY_STATUSES,
  formatDistance,
  formatDuration
} from './constants';

export const useLogistics = () => {
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
  
  // Trips state
  const [trips, setTrips] = useState([]);
  const [activeInnerTab, setActiveInnerTab] = useState('orders');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [showAddToTripModal, setShowAddToTripModal] = useState(false);  // Modal for adding to existing trip
  const [addToTripId, setAddToTripId] = useState('');  // Selected trip ID for adding orders
  const [addingToTrip, setAddingToTrip] = useState(false);  // Loading state
  const [newTripName, setNewTripName] = useState('');
  const [newTripDriver, setNewTripDriver] = useState('');
  const [newTripPipelineId, setNewTripPipelineId] = useState('');  // amoCRM pipeline for trip
  const [newTripStatusId, setNewTripStatusId] = useState('');  // amoCRM stage/status for trip
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [optimizingRoute, setOptimizingRoute] = useState(false);
  const [draggedOrderIndex, setDraggedOrderIndex] = useState(null);
  
  // Drivers state
  const [drivers, setDrivers] = useState(DEFAULT_DRIVERS);
  const [showDriversModal, setShowDriversModal] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverUserId, setNewDriverUserId] = useState('');
  const [driverUsers, setDriverUsers] = useState([]);
  
  // Map filter: 'free', 'all', 'free_plus_trip'
  const [mapFilter, setMapFilter] = useState('free');
  const [mapFilterTripId, setMapFilterTripId] = useState(null); // Trip ID for 'free_plus_trip' mode
  const [tripStatusFilter, setTripStatusFilter] = useState('planned');
  
  // Address editing state
  const [editingAddressOrderId, setEditingAddressOrderId] = useState(null);
  const [editingAddressValue, setEditingAddressValue] = useState('');
  const editAddressInputRef = useRef(null);
  
  // New order form state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    fullName: '',
    phoneNumber: '',
    fullAddress: '',
    orderComposition: ''
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
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // amoCRM sync stats
  const [amocrmStats, setAmocrmStats] = useState(null);
  const [loadingAmocrmStats, setLoadingAmocrmStats] = useState(false);
  const [amocrmPipelines, setAmocrmPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  
  // Refs
  const mapRef = useRef(null);
  const tripMapRef = useRef(null);
  const geocoderRef = useRef(null);
  const autocompleteRef = useRef(null);
  const addressInputRef = useRef(null);
  const warehouseInputRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries
  });

  // Get current section data
  const currentData = sectionData[activeSection] || { orders: [], selectedOrders: [] };
  const currentSection = SECTIONS[activeSection] || null;

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

  // Load users with driver role
  const fetchDriverUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/drivers/users`);
      if (res.ok) {
        const data = await res.json();
        setDriverUsers(data);
      }
    } catch (e) {
      console.error('Failed to load driver users:', e);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
    fetchDriverUsers();
    fetchAmocrmPipelines();
    fetchIntegrationSettings();
  }, [fetchDrivers, fetchDriverUsers]);

  // Fetch integration settings (including stage sync)
  const fetchIntegrationSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/settings`);
      if (res.ok) {
        const data = await res.json();
        // Auto-set selected pipeline/status based on current section
        if (data.stage_sync) {
          const sectionKey = currentSection;
          const stageConfig = data.stage_sync[sectionKey];
          if (stageConfig?.pipeline_id && stageConfig?.status_id) {
            setSelectedPipeline(stageConfig.pipeline_id);
            setSelectedStatus(stageConfig.status_id);
            // Auto-fetch stats
            fetchAmocrmStats(stageConfig.pipeline_id, stageConfig.status_id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load integration settings:', e);
    }
  }, [currentSection]);

  // Re-fetch stats when section changes
  useEffect(() => {
    fetchIntegrationSettings();
  }, [currentSection, fetchIntegrationSettings]);

  // Fetch amoCRM pipelines
  const fetchAmocrmPipelines = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/pipelines`);
      if (res.ok) {
        const data = await res.json();
        if (data.pipelines && data.pipelines.length > 0) {
          setAmocrmPipelines(data.pipelines);
        }
      }
    } catch (e) {
      console.error('Failed to load amoCRM pipelines:', e);
    }
  }, []);

  // Fetch amoCRM stage stats
  const fetchAmocrmStats = useCallback(async (pipelineId, statusId) => {
    if (!pipelineId || !statusId) return;
    
    setLoadingAmocrmStats(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/stage-stats/${pipelineId}/${statusId}`);
      if (res.ok) {
        const data = await res.json();
        setAmocrmStats(data);
      }
    } catch (e) {
      console.error('Failed to load amoCRM stats:', e);
    } finally {
      setLoadingAmocrmStats(false);
    }
  }, []);

  // Compare amoCRM leads with local orders
  const getAmocrmComparison = useCallback(() => {
    if (!amocrmStats || !amocrmStats.lead_ids) return null;
    
    const localOrders = currentData?.orders || [];
    // Only compare unassigned orders (not in a trip)
    const unassignedOrders = localOrders.filter(o => !o.tripId);
    const localAmocrmIds = unassignedOrders
      .filter(o => o.amocrm_id)
      .map(o => String(o.amocrm_id));
    
    const amocrmIds = amocrmStats.lead_ids;
    
    // Find which IDs are in amoCRM but not in local (free orders)
    const missingInLocal = amocrmIds.filter(id => !localAmocrmIds.includes(id));
    // Find which IDs are in local but not in amoCRM (already processed or moved to another stage)
    const extraInLocal = localAmocrmIds.filter(id => !amocrmIds.includes(id));
    
    return {
      amocrmCount: amocrmIds.length,
      localCount: localAmocrmIds.length,
      missingInLocal,
      extraInLocal,
      synced: missingInLocal.length === 0
    };
  }, [amocrmStats, currentData?.orders]);

  // Sync missing orders from amoCRM - defined as ref to be set later
  const syncMissingOrdersRef = useRef(null);

  // Search function - filters orders by query
  const searchOrders = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  // Get filtered orders based on search query
  const getFilteredOrders = useCallback((orders) => {
    if (!searchQuery || !searchQuery.trim()) return orders;
    
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(order => {
      // Search in multiple fields
      const searchFields = [
        order.clientName,
        order.fullName,
        order.phone,
        order.phoneNumber,
        order.fullAddress,
        order.addressStreet,
        order.addressCity,
        order.orderNumber,
        order.orderContents,
        order.notes,
        order.id,
        order.amocrm_id,
        order.deliveryComment
      ];
      
      return searchFields.some(field => 
        field && String(field).toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  // Get filtered trips based on search query
  const getFilteredTrips = useCallback((tripsToFilter) => {
    if (!searchQuery || !searchQuery.trim()) return tripsToFilter;
    
    const q = searchQuery.toLowerCase().trim();
    return tripsToFilter.filter(trip => {
      // Search in trip name and driver
      if (trip.name?.toLowerCase().includes(q)) return true;
      if (trip.driverName?.toLowerCase().includes(q)) return true;
      
      // Search in trip orders
      const tripOrders = trip.orders || [];
      return tripOrders.some(order => {
        const searchFields = [
          order.clientName,
          order.fullName,
          order.phone,
          order.phoneNumber,
          order.fullAddress,
          order.addressStreet,
          order.addressCity,
          order.orderNumber,
          order.orderContents,
          order.notes,
          order.id,
          order.amocrm_id
        ];
        return searchFields.some(field => 
          field && String(field).toLowerCase().includes(q)
        );
      });
    });
  }, [searchQuery]);

  // Get search results summary
  const getSearchResults = useCallback(() => {
    if (!searchQuery || !searchQuery.trim()) return null;
    
    const allOrders = currentData?.orders || [];
    const filteredOrders = getFilteredOrders(allOrders);
    const unassignedFiltered = filteredOrders.filter(o => !o.tripId);
    
    const filteredTrips = getFilteredTrips(trips);
    const tripsWithMatchingOrders = filteredTrips.length;
    
    // Count orders in trips that match
    let ordersInTripsCount = 0;
    filteredTrips.forEach(trip => {
      const tripOrders = trip.orders || [];
      tripOrders.forEach(order => {
        const q = searchQuery.toLowerCase().trim();
        const searchFields = [
          order.clientName, order.fullName, order.phone, order.phoneNumber,
          order.fullAddress, order.orderNumber, order.id
        ];
        if (searchFields.some(f => f && String(f).toLowerCase().includes(q))) {
          ordersInTripsCount++;
        }
      });
    });
    
    return {
      total: unassignedFiltered.length + ordersInTripsCount,
      unassigned: unassignedFiltered.length,
      inTrips: ordersInTripsCount,
      tripsCount: tripsWithMatchingOrders
    };
  }, [searchQuery, currentData?.orders, trips, getFilteredOrders, getFilteredTrips]);

  // Load warehouse settings
  useEffect(() => {
    const savedWarehouse = localStorage.getItem('logistics_warehouse');
    if (savedWarehouse) {
      try {
        const data = JSON.parse(savedWarehouse);
        setWarehouseAddress(data.address || '');
        setWarehouseCoords(data.coords || null);
      } catch (e) {
        console.error('Failed to load warehouse settings:', e);
      }
    }
  }, []);

  // Geocode address
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

  // Save warehouse settings
  const saveWarehouseSettings = async () => {
    if (!warehouseAddress.trim()) {
      toast.error('Введите адрес склада');
      return;
    }
    setSavingSettings(true);
    try {
      const coords = await geocodeAddress(warehouseAddress);
      setWarehouseCoords(coords);
      localStorage.setItem('logistics_warehouse', JSON.stringify({
        address: warehouseAddress,
        coords
      }));
      toast.success('Настройки сохранены');
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Failed to geocode warehouse:', error);
      toast.error('Не удалось определить координаты склада');
    } finally {
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
        body: JSON.stringify({ 
          name: newDriverName.trim(),
          userId: newDriverUserId || null
        })
      });
      if (res.ok) {
        const newDriver = await res.json();
        setDrivers(prev => [...prev, newDriver]);
        setNewDriverName('');
        setNewDriverUserId('');
        toast.success('Водитель добавлен');
      }
    } catch (e) {
      console.error('Failed to add driver:', e);
      toast.error('Ошибка добавления водителя');
    }
  };

  const updateDriver = async (driverId, updates) => {
    try {
      const res = await fetch(`${API_URL}/api/drivers/${driverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setDrivers(prev => prev.map(d => d.id === driverId ? updated : d));
        toast.success('Водитель обновлён');
      }
    } catch (e) {
      console.error('Failed to update driver:', e);
      toast.error('Ошибка обновления водителя');
    }
  };

  const removeDriver = async (driverId) => {
    try {
      const res = await fetch(`${API_URL}/api/drivers/${driverId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDrivers(prev => prev.filter(d => d.id !== driverId));
        toast.success('Водитель удалён');
      }
    } catch (e) {
      console.error('Failed to remove driver:', e);
      toast.error('Ошибка удаления водителя');
    }
  };

  // Send push notification to driver
  const [sendingNotification, setSendingNotification] = useState(false);
  
  const sendDriverNotification = async (driverId, message) => {
    if (!driverId || !message.trim()) {
      toast.error('Выберите водителя и введите сообщение');
      return false;
    }
    
    setSendingNotification(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
        return false;
      }
      
      const res = await fetch(`${API_URL}/api/notifications/send-custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ driverId, message })
      });
      
      // Handle auth errors
      if (res.status === 401 || res.status === 403) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
        return false;
      }
      
      // Use text() then parse to avoid "body stream already read" error
      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse response:', responseText);
        toast.error('Ошибка сервера');
        return false;
      }
      
      if (res.ok) {
        if (data.status === 'sent') {
          toast.success(`✅ Уведомление отправлено: ${data.method}`);
          return true;
        } else if (data.status === 'not_delivered') {
          toast.warning(`⚠️ ${data.message}: ${data.method}`, { duration: 5000 });
          return false;
        } else {
          toast.info(`ℹ️ ${data.method}`);
          return false;
        }
      } else {
        toast.error(data.detail || 'Ошибка отправки');
        return false;
      }
    } catch (e) {
      console.error('Failed to send notification:', e);
      toast.error('Ошибка сети');
      return false;
    } finally {
      setSendingNotification(false);
    }
  };

  // Get driver notification status
  const getDriverNotificationStatus = async (driverId) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;
      
      const res = await fetch(`${API_URL}/api/notifications/debug/driver/${driverId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to get driver status:', e);
      return null;
    }
  };

  // Fetch orders for a section
  const fetchSectionOrders = useCallback(async (sectionId) => {
    const section = SECTIONS[sectionId];
    try {
      const res = await fetch(`${API_URL}${section.endpoint}`);
      if (res.ok) {
        const allOrders = await res.json();
        // Filter to show only amoCRM orders
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

  // Geocode orders in background
  const geocodeOrdersInBackground = useCallback(async (orders, sectionId) => {
    if (!geocoderRef.current) return;
    
    const section = SECTIONS[sectionId];
    const ordersToGeocode = orders.filter(o => 
      (o.fullAddress || o.address) && !o.lat && !o.lng
    );
    
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
          
          setSectionData(prev => ({
            ...prev,
            [sectionId]: {
              ...prev[sectionId],
              orders: prev[sectionId].orders.map(o => 
                o.id === order.id ? { ...o, lat: coords.lat, lng: coords.lng } : o
              )
            }
          }));
          
          fetch(`${API_URL}${section.endpoint}/${order.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...order, lat: coords.lat, lng: coords.lng })
          }).catch(console.error);
          
        } catch (error) {
          console.log(`Could not geocode order ${order.id}: ${error.message}`);
        }
      }));
      
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

  // Sync missing orders from amoCRM
  const syncMissingOrders = useCallback(async (missingIds) => {
    if (!missingIds || missingIds.length === 0) return null;
    
    const sectionMap = {
      balia: 'balia',
      greenhouse: 'greenhouse',
      sauna: 'sauna'
    };
    
    const section = sectionMap[activeSection];
    if (!section) return null;
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Необходима авторизация');
      return null;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/integrations/amocrm/sync-missing/${section}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(missingIds)
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync missing orders');
      }
      
      const result = await response.json();
      
      // Reload all orders after sync
      if (result.synced_count > 0) {
        await fetchAllOrders();
      }
      
      return result;
    } catch (error) {
      console.error('Error syncing missing orders:', error);
      throw error;
    }
  }, [activeSection, fetchAllOrders]);

  // Update ref for external use
  useEffect(() => {
    syncMissingOrdersRef.current = syncMissingOrders;
  }, [syncMissingOrders]);

  // Fetch trips
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
          driverName: driver?.name || null,
          amocrmPipelineId: newTripPipelineId || null,
          amocrmStatusId: newTripStatusId || null
        })
      });
      
      if (res.ok) {
        const trip = await res.json();
        toast.success(`Рейс "${trip.name}" создан`);
        setShowCreateTripModal(false);
        setNewTripName('');
        setNewTripDriver('');
        setNewTripPipelineId('');
        setNewTripStatusId('');
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
  const updateTrip = async (tripId, updates, syncOrderStatuses = false) => {
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, syncOrderStatuses })
      });
      if (res.ok) {
        const updatedTrip = await res.json();
        fetchTrips();
        fetchAllOrders(); // Reload orders to get updated trip data (driver, date, status)
        
        // Update selectedTrip if it's the one being updated
        if (selectedTrip?.id === tripId) {
          setSelectedTrip(updatedTrip);
        }
        
        toast.success('Рейс обновлён');
        return updatedTrip;
      }
    } catch (error) {
      console.error('Error updating trip:', error);
      toast.error('Ошибка обновления');
    }
    return null;
  };

  // Update trip status and sync all order statuses
  const updateTripStatus = async (tripId, newStatus) => {
    return await updateTrip(tripId, { status: newStatus }, true);
  };

  // Force sync trip to amoCRM
  const [syncingToAmocrm, setSyncingToAmocrm] = useState(false);
  
  const syncTripToAmocrm = async (tripId) => {
    setSyncingToAmocrm(true);
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}/sync-amocrm`, {
        method: 'POST'
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.status === 'ok') {
          toast.success(result.message);
        } else if (result.status === 'warning') {
          toast.warning(result.message);
        } else {
          toast.info(`${result.message}${result.errors ? '\nОшибки: ' + result.errors.join(', ') : ''}`);
        }
        
        // Update selectedTrip with new lastSyncedAt
        if (selectedTrip?.id === tripId && result.lastSyncedAt) {
          setSelectedTrip(prev => ({ ...prev, lastSyncedAt: result.lastSyncedAt }));
        }
        
        fetchTrips(); // Refresh trips to get updated lastSyncedAt
        fetchAllOrders(); // Refresh to show updated data
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка синхронизации');
      }
    } catch (error) {
      console.error('Error syncing to amoCRM:', error);
      toast.error('Ошибка синхронизации с amoCRM');
    } finally {
      setSyncingToAmocrm(false);
    }
  };

  // Add orders to existing trip
  const addOrdersToTrip = async (tripId) => {
    if (!tripId || currentData.selectedOrders.length === 0) {
      toast.error('Выберите рейс и заказы');
      return;
    }
    
    setAddingToTrip(true);
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}/add-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentData.selectedOrders)
      });
      
      if (res.ok) {
        const result = await res.json();
        toast.success(`Добавлено ${result.added.length} заказов в рейс`);
        setShowAddToTripModal(false);
        setAddToTripId('');
        fetchAllOrders();
        fetchTrips();
        setSectionData(prev => ({
          ...prev,
          [activeSection]: { ...prev[activeSection], selectedOrders: [] }
        }));
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка добавления заказов');
      }
    } catch (error) {
      console.error('Error adding orders to trip:', error);
      toast.error('Ошибка добавления заказов');
    } finally {
      setAddingToTrip(false);
    }
  };

  // Delete trip
  const deleteTrip = async (tripId) => {
    if (!window.confirm('Удалить рейс? Заказы вернутся в общий список.')) return;
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Рейс удалён');
        fetchTrips();
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

  // Update order status in trip
  const updateOrderStatusInTrip = async (tripId, orderId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}/order-status/${orderId}?status=${newStatus}`, {
        method: 'PUT'
      });
      if (res.ok) {
        if (selectedTrip?.id === tripId) {
          setSelectedTrip(prev => ({
            ...prev,
            orderStatuses: { ...prev.orderStatuses, [orderId]: newStatus }
          }));
        }
        fetchTrips();
        fetchAllOrders(); // Reload orders to get updated trip data
        toast.success('Статус обновлён');
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
        body: JSON.stringify([orderId])
      });
      if (res.ok) {
        const data = await res.json();
        
        if (selectedTrip?.id === tripId) {
          setSelectedTrip(prev => ({
            ...prev,
            orderIds: prev.orderIds.filter(id => id !== orderId)
          }));
        }
        fetchTrips();
        fetchAllOrders();
        
        // Show detailed message about amoCRM sync
        if (data.amocrm_orders_count > 0) {
          const settings = data.amocrm_settings || {};
          const successCount = data.amocrm_success_count || 0;
          const errorCount = data.amocrm_error_count || 0;
          const skippedCount = data.amocrm_skipped_count || 0;
          
          if (!settings.configured) {
            toast.warning('Заказ убран из рейса. Настройки amoCRM не найдены.');
          } else if (!settings.domain_set || !settings.token_set) {
            toast.warning('Заказ убран из рейса. Укажите домен и токен amoCRM для очистки данных в CRM.');
          } else if (!settings.trip_fields_configured) {
            toast.warning('Заказ убран из рейса. Укажите ID полей рейса в настройках amoCRM.');
          } else if (successCount > 0) {
            toast.success(`Заказ убран из рейса, данные очищены в amoCRM (${successCount} из ${data.amocrm_orders_count})`);
          } else if (errorCount > 0) {
            // Get detailed error info from results
            const errorResult = data.amocrm_clear_results?.find(r => r.status === 'error');
            const errorDetail = errorResult?.detail || errorResult?.message || 'Неизвестная ошибка';
            toast.error(`Заказ убран, но ошибка очистки amoCRM: ${errorDetail}`);
          } else if (skippedCount > 0) {
            const skipResult = data.amocrm_clear_results?.find(r => r.status === 'skipped');
            toast.warning(`Заказ убран из рейса. amoCRM: ${skipResult?.message || 'пропущено'}`);
          } else {
            toast.success('Заказ убран из рейса');
          }
        } else {
          toast.success('Заказ убран из рейса');
        }
      }
    } catch (error) {
      console.error('Error removing order:', error);
      toast.error('Ошибка удаления заказа из рейса');
    }
  };

  // Update trip order IDs
  const updateTripOrderIds = async (tripId, newOrderIds) => {
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: newOrderIds })
      });
      if (res.ok) {
        setSelectedTrip(prev => prev ? { ...prev, orderIds: newOrderIds } : null);
        fetchTrips();
      }
    } catch (error) {
      console.error('Error updating trip order:', error);
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
      toast.error('Нужен минимум 1 заказ с координатами на карте');
      return;
    }

    const useWarehouse = warehouseCoords && warehouseCoords.lat && warehouseCoords.lng;
    
    if (!useWarehouse && ordersWithCoords.length < 2) {
      toast.error('Укажите адрес склада в настройках или добавьте минимум 2 заказа');
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
        const optimizedOrders = [
          ordersWithCoords[0],
          ...optimizedMiddle,
          ordersWithCoords[ordersWithCoords.length - 1]
        ];
        newOrderIds = optimizedOrders.map(o => o.id);
      }
      
      const ordersWithoutCoords = selectedTrip.orderIds.filter(id => {
        const order = sectionData[selectedTrip.section]?.orders.find(o => o.id === id);
        return !order || !order.lat || !order.lng;
      });
      newOrderIds.push(...ordersWithoutCoords);

      await updateTripOrderIds(selectedTrip.id, newOrderIds);
      
      setTripDirections(result);
      setTripRouteInfo({
        distance: result.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0),
        duration: result.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0)
      });
      
      const totalDistance = result.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
      const totalDuration = result.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0);
      toast.success(`Маршрут оптимизирован! ${formatDistance(totalDistance)}, ${formatDuration(totalDuration)}`);
    } catch (error) {
      console.error('Error optimizing route:', error);
      toast.error('Ошибка оптимизации маршрута');
    } finally {
      setOptimizingRoute(false);
    }
  };

  // Build trip route
  const buildTripRoute = useCallback(async () => {
    if (!selectedTrip || !selectedTrip.orderIds || selectedTrip.orderIds.length < 1) {
      setTripDirections(null);
      setTripRouteInfo(null);
      return;
    }

    const ordersWithCoords = selectedTrip.orderIds
      .map(id => sectionData[selectedTrip.section]?.orders.find(o => o.id === id))
      .filter(o => o && o.lat && o.lng);

    if (ordersWithCoords.length < 1) {
      setTripDirections(null);
      setTripRouteInfo(null);
      return;
    }

    const useWarehouse = warehouseCoords && warehouseCoords.lat && warehouseCoords.lng;
    
    if (!useWarehouse && ordersWithCoords.length < 2) {
      setTripDirections(null);
      setTripRouteInfo(null);
      return;
    }

    setBuildingTripRoute(true);
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
        optimizeWaypoints: false,
        travelMode: window.google.maps.TravelMode.DRIVING
      });

      setTripDirections(result);
      setTripRouteInfo({
        distance: result.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0),
        duration: result.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0)
      });
    } catch (error) {
      console.error('Error building trip route:', error);
      setTripDirections(null);
      setTripRouteInfo(null);
    } finally {
      setBuildingTripRoute(false);
    }
  }, [selectedTrip, sectionData, warehouseCoords]);

  // Build trip route when selected trip changes
  useEffect(() => {
    if (selectedTrip && isLoaded && activeInnerTab === 'trips') {
      buildTripRoute();
    } else {
      setTripDirections(null);
      setTripRouteInfo(null);
    }
  }, [selectedTrip, selectedTrip?.orderIds, isLoaded, activeInnerTab, warehouseCoords, buildTripRoute]);

  // Move order up/down in trip
  const moveOrderUp = async (index) => {
    if (!selectedTrip || index <= 0) return;
    const newOrderIds = [...selectedTrip.orderIds];
    [newOrderIds[index - 1], newOrderIds[index]] = [newOrderIds[index], newOrderIds[index - 1]];
    await updateTripOrderIds(selectedTrip.id, newOrderIds);
    toast.success('Порядок изменён');
  };

  const moveOrderDown = async (index) => {
    if (!selectedTrip || index >= selectedTrip.orderIds.length - 1) return;
    const newOrderIds = [...selectedTrip.orderIds];
    [newOrderIds[index], newOrderIds[index + 1]] = [newOrderIds[index + 1], newOrderIds[index]];
    await updateTripOrderIds(selectedTrip.id, newOrderIds);
    toast.success('Порядок изменён');
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedOrderIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedOrderIndex === null || draggedOrderIndex === dropIndex) {
      setDraggedOrderIndex(null);
      return;
    }
    const newOrderIds = [...selectedTrip.orderIds];
    const [draggedItem] = newOrderIds.splice(draggedOrderIndex, 1);
    newOrderIds.splice(dropIndex, 0, draggedItem);
    await updateTripOrderIds(selectedTrip.id, newOrderIds);
    setDraggedOrderIndex(null);
    toast.success('Порядок изменён');
  };

  const handleDragEnd = () => {
    setDraggedOrderIndex(null);
  };

  // Get unassigned orders
  const getUnassignedOrders = (orders) => {
    return orders.filter(o => !o.tripId);
  };

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

  // Toggle important flag
  const toggleOrderImportant = async (orderId) => {
    try {
      const order = currentData.orders.find(o => o.id === orderId);
      if (!order) return;
      
      const newImportant = !order.isImportant;
      const endpoint = activeSection === 'greenhouse' ? 'greenhouse' : activeSection === 'sauna' ? 'sauna' : 'balia';
      
      await fetch(`${API_URL}/api/${endpoint}/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isImportant: newImportant })
      });
      
      setSectionData(prev => ({
        ...prev,
        [activeSection]: {
          ...prev[activeSection],
          orders: prev[activeSection].orders.map(o => 
            o.id === orderId ? { ...o, isImportant: newImportant } : o
          )
        }
      }));
      
      toast.success(newImportant ? 'Заказ отмечен как важный' : 'Отметка снята');
    } catch (error) {
      console.error('Error toggling important:', error);
      toast.error('Ошибка');
    }
  };

  // Update order field
  const updateOrderField = async (orderId, updates) => {
    try {
      const order = currentData.orders.find(o => o.id === orderId);
      if (!order) return false;
      
      const updatedOrder = { ...order, ...updates };
      
      setSectionData(prev => ({
        ...prev,
        [activeSection]: {
          ...prev[activeSection],
          orders: prev[activeSection].orders.map(o => 
            o.id === orderId ? updatedOrder : o
          )
        }
      }));

      const response = await fetch(`${API_URL}${currentSection.endpoint}/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      // Sync to amoCRM if needed - send all order data including trip info
      if (order?.amocrm_id) {
        try {
          const statusLabel = updates.deliveryStatus 
            ? (DELIVERY_STATUSES[updates.deliveryStatus]?.label || updates.deliveryStatus) 
            : null;
          const comment = updates.deliveryComment || order.deliveryComment || '';
          
          // Build query params for sync-order endpoint
          const params = new URLSearchParams();
          params.append('amocrm_id', order.amocrm_id);
          
          if (statusLabel) {
            params.append('delivery_status', statusLabel);
          }
          if (comment) {
            params.append('delivery_comment', comment);
          }
          
          // Include trip data from order
          const updatedOrderData = { ...order, ...updates };
          if (updatedOrderData.tripName) {
            params.append('trip_name', updatedOrderData.tripName);
          }
          if (updatedOrderData.tripDriverName) {
            params.append('trip_driver_name', updatedOrderData.tripDriverName);
          }
          if (updatedOrderData.tripDepartureDate) {
            params.append('trip_departure_date', updatedOrderData.tripDepartureDate);
          }
          if (updatedOrderData.tripOrderStatus) {
            params.append('trip_order_status', updatedOrderData.tripOrderStatus);
          }
          
          await fetch(`${API_URL}/api/integrations/amocrm/sync-order?${params.toString()}`, {
            method: 'POST'
          });
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

  // Update delivery status
  const updateDeliveryStatus = async (orderId, newStatus, deliveryComment = '') => {
    const success = await updateOrderField(orderId, { deliveryStatus: newStatus, deliveryComment });
    if (success) {
      toast.success('Статус обновлён');
    } else {
      toast.error('Ошибка обновления статуса');
      fetchAllOrders();
    }
  };

  // Save edited address
  const saveEditedAddress = async (orderId) => {
    if (!editingAddressValue.trim()) {
      toast.error('Введите адрес');
      return;
    }

    const order = currentData.orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      let lat = null;
      let lng = null;
      
      if (geocoderRef.current) {
        await new Promise((resolve) => {
          geocoderRef.current.geocode({ address: editingAddressValue }, (results, status) => {
            if (status === 'OK' && results[0]) {
              lat = results[0].geometry.location.lat();
              lng = results[0].geometry.location.lng();
            }
            resolve();
          });
        });
      }

      const section = order.orderType || activeSection;
      const endpoint = section === 'greenhouse' ? 'greenhouse' : section === 'sauna' ? 'sauna' : 'balia';
      
      const updateData = {
        fullAddress: editingAddressValue,
        ...(lat && lng && { lat, lng })
      };
      
      await fetch(`${API_URL}/api/${endpoint}/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      setSectionData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          orders: prev[section].orders.map(o => 
            o.id === orderId ? { ...o, ...updateData } : o
          )
        }
      }));

      setEditingAddressOrderId(null);
      setEditingAddressValue('');
      toast.success(lat ? 'Адрес сохранён и геокодирован' : 'Адрес сохранён');
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Ошибка сохранения адреса');
    }
  };

  // Start editing address
  const startEditingAddress = (orderId, currentAddress) => {
    setEditingAddressOrderId(orderId);
    setEditingAddressValue(currentAddress || '');
  };

  // Cancel editing address
  const cancelEditingAddress = () => {
    setEditingAddressOrderId(null);
    setEditingAddressValue('');
  };

  // Build route
  const buildRoute = async () => {
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

  // Open in Google Maps
  const openInGoogleMaps = () => {
    const ordersWithCoords = currentData.selectedOrders
      .map(id => currentData.orders.find(o => o.id === id))
      .filter(o => o && o.lat && o.lng);
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

  // Bulk update orders
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

  // Get map orders based on filter
  const getMapOrders = (orders) => {
    if (!orders) return [];
    
    return orders.filter(o => {
      if (!o.lat || !o.lng) return false;
      
      if (mapFilter === 'free') {
        return !o.tripId;
      } else if (mapFilter === 'all') {
        return true;
      } else if (mapFilter === 'free_plus_trip' && mapFilterTripId) {
        return !o.tripId || o.tripId === mapFilterTripId;
      }
      return true;
    });
  };

  // Get marker icon for order
  const getMarkerIcon = (order) => {
    const isImportant = order.isImportant;
    const inTrip = !!order.tripId;
    const isInSelectedTrip = mapFilterTripId && order.tripId === mapFilterTripId;
    
    let color = '#22c55e'; // Green - free
    if (isImportant) color = '#ef4444'; // Red - important
    else if (isInSelectedTrip) color = '#9ca3af'; // Light gray - in selected trip
    else if (inTrip) color = '#6b7280'; // Dark gray - in other trip
    
    if (isImportant) {
      return {
        path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
        fillColor: color,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
        scale: 1.2,
        anchor: new window.google.maps.Point(12, 12)
      };
    }
    
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: 'white',
      strokeWeight: 2
    };
  };

  // Map load callback
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();
  }, []);

  // Shared autocomplete configuration
  const AUTOCOMPLETE_COUNTRIES = ['pl', 'de', 'cz', 'sk', 'lt', 'lv', 'ee', 'ua', 'by'];
  
  // Helper to initialize autocomplete on an input element
  const initAutocomplete = useCallback((inputElement, onPlaceSelect, options = {}) => {
    if (!inputElement || !window.google?.maps?.places?.Autocomplete) return null;
    
    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
        types: options.types || ['address'],
        componentRestrictions: { country: options.countries || AUTOCOMPLETE_COUNTRIES },
        fields: options.fields || ['formatted_address', 'geometry', 'address_components']
      });
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place?.formatted_address) {
          onPlaceSelect({
            address: place.formatted_address,
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng(),
            components: place.address_components
          });
        }
      });
      
      return autocomplete;
    } catch (e) {
      console.error('Failed to initialize autocomplete:', e);
      return null;
    }
  }, []);

  // Initialize autocomplete for address editing
  useEffect(() => {
    if (isLoaded && editingAddressOrderId && editAddressInputRef.current) {
      const autocomplete = initAutocomplete(
        editAddressInputRef.current,
        (place) => setEditingAddressValue(place.address)
      );
      
      return () => {
        if (autocomplete && window.google?.maps?.event) {
          window.google.maps.event.clearInstanceListeners(autocomplete);
        }
      };
    }
  }, [isLoaded, editingAddressOrderId, initAutocomplete]);

  // Initialize form autocomplete
  useEffect(() => {
    if (!isLoaded || !showOrderForm || !addressInputRef.current) return;
    if (autocompleteRef.current) return;
    
    autocompleteRef.current = initAutocomplete(
      addressInputRef.current,
      (place) => setNewOrderForm(prev => ({ ...prev, fullAddress: place.address }))
    );
    
    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, showOrderForm, initAutocomplete]);

  // Initial data load
  useEffect(() => {
    fetchAllOrders();
    fetchTrips(); // Load ALL trips for counters
  }, [fetchAllOrders, fetchTrips]);
  
  // Reset inner tab when section changes
  useEffect(() => {
    setActiveInnerTab('orders');
    setSelectedTrip(null);
  }, [activeSection]);

  // Format helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Print trip orders
  const printTripOrders = (trip, sectionData) => {
    if (!trip || !trip.orderIds || trip.orderIds.length === 0) {
      toast.error('Нет заказов для печати');
      return;
    }

    const orders = trip.orderIds
      .map(orderId => sectionData[trip.section]?.orders.find(o => o.id === orderId))
      .filter(Boolean);

    if (orders.length === 0) {
      toast.error('Заказы не найдены');
      return;
    }

    // Create print window content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Рейс: ${trip.name || 'Без названия'}</title>
        <style>
          * { box-sizing: border-box; }
          
          /* Page setup for printing - Portrait orientation */
          @page {
            size: A4 portrait;
            margin: 10mm 8mm 10mm 8mm;
          }
          
          body { 
            font-family: Arial, sans-serif; 
            padding: 5px; 
            max-width: 100%;
            font-size: 9px;
            line-height: 1.15;
          }
          h1 { 
            font-size: 14px; 
            margin-bottom: 5px;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
          }
          .trip-info {
            margin-bottom: 8px;
            padding: 5px;
            background: #f5f5f5;
            border-radius: 3px;
            font-size: 9px;
          }
          .trip-info p {
            margin: 1px 0;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 5px;
          }
          th, td { 
            border: 1px solid #ccc; 
            padding: 3px 4px; 
            text-align: left;
            vertical-align: top;
            font-size: 8px;
          }
          th { 
            background-color: #f0f0f0; 
            font-weight: bold;
            font-size: 8px;
            padding: 4px 4px;
          }
          
          /* Prevent row breaks across pages */
          tr { 
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Keep table header with content */
          thead {
            display: table-header-group;
          }
          
          tr:nth-child(even) { background-color: #fafafa; }
          .order-num { 
            font-weight: bold; 
            text-align: center;
            width: 18px;
            font-size: 9px;
          }
          .important { 
            background-color: #fff3cd !important;
            font-weight: bold;
          }
          .important td:first-child::before {
            content: "⚠ ";
          }
          .phone { 
            white-space: nowrap;
            font-size: 8px;
          }
          .client {
            font-size: 8px;
            max-width: 80px;
          }
          .contents { 
            font-size: 8px;
            max-width: 130px;
            white-space: pre-line;
            line-height: 1.1;
          }
          .address {
            max-width: 120px;
            font-size: 8px;
          }
          .sum {
            white-space: nowrap;
            text-align: right;
            font-size: 8px;
          }
          .comment {
            font-size: 8px;
            max-width: 100px;
          }
          
          /* Trip header in table - repeats on each page */
          .trip-header {
            background-color: #1f2937 !important;
            color: white !important;
            font-size: 10px;
            font-weight: bold;
            text-align: left;
            padding: 5px 6px;
          }
          .trip-header-row {
            background-color: #1f2937 !important;
          }
          
          @media print {
            body { 
              padding: 0; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print { display: none; }
            
            /* Ensure rows don't break */
            tr { 
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        <h1>🚛 ${trip.name || 'Рейс'} | 📅 ${trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('ru-RU') : ''}</h1>
        <div class="trip-info">
          <p><strong>Водитель:</strong> ${trip.driverName || 'Не назначен'} &nbsp;|&nbsp; <strong>Заказов:</strong> ${orders.length}</p>
        </div>
        
        <table>
          <thead>
            <tr class="trip-header-row">
              <th colspan="8" class="trip-header">
                🚛 ${trip.name || 'Рейс'} | 📅 ${trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('ru-RU') : ''} | 👤 ${trip.driverName || '-'}
              </th>
            </tr>
            <tr>
              <th class="order-num">№</th>
              <th class="client">Клиент</th>
              <th class="phone">Телефон</th>
              <th class="address">Адрес</th>
              <th class="contents">Состав заказа</th>
              <th class="sum">Сумма</th>
              <th class="sum">Долг</th>
              <th class="comment">Примечание</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((order, index) => {
              // Extract only numbered items from order contents, or show original if no numbered items
              let contents = order.orderContents || order.orderDetails || '-';
              if (contents && contents !== '-') {
                // Split by lines and filter only numbered items (1. 2. 3. etc)
                const lines = contents.split(/[\n\r]+/);
                const numberedItems = lines.filter(line => {
                  const trimmed = line.trim();
                  // Keep only lines that start with a number followed by . or )
                  return /^\d+[\.\)]\s*.+/.test(trimmed);
                });
                
                if (numberedItems.length > 0) {
                  // Clean up each item - remove prices if present at the end
                  contents = numberedItems.map(item => {
                    // Remove price patterns like "- 1000 zł" or "1000,00 zł" at the end
                    return item.trim()
                      .replace(/\s*[-–]\s*[\d\s,.]+\s*(zł|PLN|EUR|€)?\s*$/i, '')
                      .replace(/\s*[\d\s,.]+\s*(zł|PLN|EUR|€)\s*$/i, '')
                      .trim();
                  }).join('\n');
                }
                // If no numbered items found, keep original contents as-is
              }
              return `
              <tr class="${order.isImportant ? 'important' : ''}">
                <td class="order-num">${index + 1}</td>
                <td class="client">${order.fullName || order.customerName || '-'}</td>
                <td class="phone">${order.phoneNumber || order.phone || '-'}</td>
                <td class="address">${order.fullAddress || order.address || '-'}</td>
                <td class="contents">${contents}</td>
                <td class="sum">${order.dealSum || order.orderSum || '-'}</td>
                <td class="sum" style="color: ${order.debtSum ? '#dc2626' : 'inherit'}; font-weight: ${order.debtSum ? 'bold' : 'normal'};">${order.debtSum || '-'}</td>
                <td class="comment">${order.orderComment || order.notes || '-'}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
        
        <p style="margin-top: 15px; font-size: 8px; color: #999;">
          Распечатано: ${new Date().toLocaleString('ru-RU')}
        </p>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      toast.error('Не удалось открыть окно печати. Проверьте блокировщик всплывающих окон.');
    }
  };

  return {
    // State
    isLoaded,
    loadError,
    loading,
    activeSection,
    setActiveSection,
    sectionData,
    setSectionData,
    currentData,
    currentSection,
    expandedOrder,
    setExpandedOrder,
    buildingRoute,
    
    // Trips
    trips,
    activeInnerTab,
    setActiveInnerTab,
    selectedTrip,
    setSelectedTrip,
    showCreateTripModal,
    setShowCreateTripModal,
    showAddToTripModal,
    setShowAddToTripModal,
    addToTripId,
    setAddToTripId,
    addingToTrip,
    newTripName,
    setNewTripName,
    newTripDriver,
    setNewTripDriver,
    newTripPipelineId,
    setNewTripPipelineId,
    newTripStatusId,
    setNewTripStatusId,
    creatingTrip,
    optimizingRoute,
    draggedOrderIndex,
    tripDirections,
    tripRouteInfo,
    buildingTripRoute,
    tripStatusFilter,
    setTripStatusFilter,
    
    // Search
    searchQuery,
    setSearchQuery,
    searchOrders,
    getFilteredOrders,
    getFilteredTrips,
    getSearchResults,
    
    // Drivers
    drivers,
    showDriversModal,
    setShowDriversModal,
    newDriverName,
    setNewDriverName,
    newDriverUserId,
    setNewDriverUserId,
    driverUsers,
    updateDriver,
    sendDriverNotification,
    sendingNotification,
    getDriverNotificationStatus,
    
    // Map
    mapFilter,
    setMapFilter,
    mapFilterTripId,
    setMapFilterTripId,
    warehouseAddress,
    setWarehouseAddress,
    warehouseCoords,
    showSettingsModal,
    setShowSettingsModal,
    savingSettings,
    
    // Order form
    showOrderForm,
    setShowOrderForm,
    newOrderForm,
    setNewOrderForm,
    creatingOrder,
    
    // Address editing
    editingAddressOrderId,
    editingAddressValue,
    setEditingAddressValue,
    editAddressInputRef,
    
    // Refs
    mapRef,
    tripMapRef,
    addressInputRef,
    warehouseInputRef,
    autocompleteRef,
    
    // Actions
    fetchAllOrders,
    fetchTrips,
    createTrip,
    updateTrip,
    updateTripStatus,
    syncTripToAmocrm,
    syncingToAmocrm,
    addOrdersToTrip,
    deleteTrip,
    updateOrderStatusInTrip,
    removeOrderFromTrip,
    optimizeTripRoute,
    buildTripRoute,
    printTripOrders,
    moveOrderUp,
    moveOrderDown,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    addDriver,
    removeDriver,
    saveWarehouseSettings,
    toggleOrderSelection,
    toggleOrderImportant,
    updateOrderField,
    updateDeliveryStatus,
    saveEditedAddress,
    startEditingAddress,
    cancelEditingAddress,
    buildRoute,
    clearRoute,
    openInGoogleMaps,
    handleCreateOrder,
    deleteOrder,
    bulkUpdateOrders,
    getUnassignedOrders,
    getMapOrders,
    getMarkerIcon,
    onMapLoad,
    formatDate,
    formatDistance,
    formatDuration,
    
    // amoCRM sync stats
    amocrmStats,
    loadingAmocrmStats,
    amocrmPipelines,
    selectedPipeline,
    setSelectedPipeline,
    selectedStatus,
    setSelectedStatus,
    fetchAmocrmStats,
    getAmocrmComparison,
    syncMissingOrders,
    API_URL
  };
};

export default useLogistics;
