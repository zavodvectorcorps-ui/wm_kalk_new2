// Logistics constants and helpers
import { Circle, Package, Truck, CheckCircle, XCircle, Waves, Flame, Warehouse } from 'lucide-react';

// Smart API URL detection - use current origin on production
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('wm-kalkulator.pl') || origin.includes('.emergent.host') || origin.includes('.emergentagent.com')) {
      return origin;
    }
  }
  return process.env.REACT_APP_BACKEND_URL || '';
};

export const API_URL = getApiUrl();
export const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '8px'
};

export const defaultCenter = {
  lat: 52.0693,
  lng: 19.4803
};

export const libraries = ['places', 'geometry'];

// Delivery status options for individual orders
export const DELIVERY_STATUSES = {
  pending: { label: 'Ожидает', labelPl: 'Oczekuje', color: 'bg-gray-100 text-gray-700', icon: Circle },
  preparing: { label: 'Готовится', labelPl: 'W przygotowaniu', color: 'bg-yellow-100 text-yellow-700', icon: Package },
  in_transit: { label: 'В пути', labelPl: 'W drodze', color: 'bg-blue-100 text-blue-700', icon: Truck },
  delivered: { label: 'Доставлено', labelPl: 'Dostarczone', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Отменён', labelPl: 'Anulowany', color: 'bg-red-100 text-red-700', icon: XCircle }
};

// Trip status categories (matches trip status tabs)
export const TRIP_STATUSES = {
  planned: { label: 'Готов к отправке', color: 'bg-yellow-100 text-yellow-700', icon: Package },
  in_transit: { label: 'В пути', color: 'bg-blue-100 text-blue-700', icon: Truck },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-700', icon: CheckCircle }
};

// Order status within trip - synced with trip statuses
export const ORDER_TRIP_STATUSES = {
  pending: { label: 'Ожидает', color: 'bg-gray-100 text-gray-700' },
  preparing: { label: 'Готовится', color: 'bg-yellow-100 text-yellow-700' },
  delivering: { label: 'В пути', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700' }
};

// Map trip status to order status for auto-sync
export const TRIP_TO_ORDER_STATUS = {
  planned: 'pending',
  in_transit: 'delivering',
  delivered: 'delivered'
};

// Default drivers list
export const DEFAULT_DRIVERS = [
  { id: 'driver1', name: 'Водитель 1' },
  { id: 'driver2', name: 'Водитель 2' },
  { id: 'driver3', name: 'Водитель 3' }
];

// Section configurations for product types
export const SECTIONS = {
  greenhouse: {
    id: 'greenhouse',
    name: { ru: 'Теплицы', pl: 'Szklarnie' },
    icon: Warehouse,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-500',
    endpoint: '/api/greenhouse/orders?for_logistics=true',
    markerColor: '#16a34a'
  },
  balia: {
    id: 'balia',
    name: { ru: 'Купели', pl: 'Balie' },
    icon: Waves,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-500',
    endpoint: '/api/orders?for_logistics=true',
    markerColor: '#2563eb'
  },
  sauna: {
    id: 'sauna',
    name: { ru: 'Сауны', pl: 'Sauny' },
    icon: Flame,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-500',
    endpoint: '/api/sauna/orders?for_logistics=true',
    markerColor: '#ea580c'
  }
};

// Helper functions
export const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  const dateOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  
  if (includeTime) {
    dateOptions.hour = '2-digit';
    dateOptions.minute = '2-digit';
  }
  
  return date.toLocaleDateString('ru-RU', dateOptions);
};

// Format datetime for history display (always includes time)
export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDistance = (meters) => {
  if (!meters) return '';
  if (meters < 1000) return `${meters} м`;
  return `${(meters / 1000).toFixed(1)} км`;
};

export const formatDuration = (seconds) => {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
};

// Get marker icon based on order state
export const getMarkerIcon = (order, google) => {
  if (!google) return null;
  
  const isImportant = order.isImportant;
  const inTrip = !!order.tripId;
  
  let color = '#22c55e'; // Green - free
  if (isImportant) color = '#ef4444'; // Red - important
  else if (inTrip) color = '#9ca3af'; // Gray - in trip
  
  if (isImportant) {
    return {
      path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: 'white',
      strokeWeight: 2,
      scale: 1.2,
      anchor: new google.maps.Point(12, 12)
    };
  }
  
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: 'white',
    strokeWeight: 2
  };
};

// Filter orders for map display
// mapFilter can be: 'free', 'all', or trip id (e.g., 'BAL-123456')
export const getMapOrders = (orders, mapFilter, tripId = null) => {
  if (!orders) return [];
  
  return orders.filter(o => {
    // Must have coordinates
    if (!o.lat || !o.lng) return false;
    
    // Filter modes
    if (mapFilter === 'free') {
      return !o.tripId;
    } else if (mapFilter === 'all') {
      return true;
    } else if (mapFilter === 'free_plus_trip' && tripId) {
      // Show free orders OR orders from selected trip
      return !o.tripId || o.tripId === tripId;
    }
    return true;
  });
};

// Get marker color based on order state and filter context
export const getMarkerColor = (order, selectedTripId = null) => {
  const isImportant = order.isImportant;
  const inTrip = !!order.tripId;
  const isInSelectedTrip = selectedTripId && order.tripId === selectedTripId;
  
  if (isImportant) return '#ef4444'; // Red - important
  if (isInSelectedTrip) return '#9ca3af'; // Gray - in selected trip
  if (inTrip) return '#6b7280'; // Dark gray - in other trip
  return '#22c55e'; // Green - free
};
