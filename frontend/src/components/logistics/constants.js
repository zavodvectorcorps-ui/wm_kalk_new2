import { Circle, Package, Truck, CheckCircle, Waves, Flame, Warehouse } from 'lucide-react';

export const API_URL = process.env.REACT_APP_BACKEND_URL;
export const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export const mapContainerStyle = {
  width: '100%',
  height: '500px'
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
  delivered: { label: 'Доставлено', labelPl: 'Dostarczone', color: 'bg-green-100 text-green-700', icon: CheckCircle }
};

// Trip status categories
export const TRIP_STATUSES = {
  planned: { label: 'Готов к отправке', color: 'bg-yellow-100 text-yellow-700', icon: Package },
  in_transit: { label: 'В пути', color: 'bg-blue-100 text-blue-700', icon: Truck },
  completed: { label: 'Доставлен', color: 'bg-green-100 text-green-700', icon: CheckCircle }
};

// Order status within trip
export const ORDER_TRIP_STATUSES = {
  pending: { label: 'Ожидает', color: 'bg-gray-100 text-gray-700' },
  delivering: { label: 'В доставке', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700' }
};

// Default drivers
export const DEFAULT_DRIVERS = [
  { id: 'driver1', name: 'Водитель 1' },
  { id: 'driver2', name: 'Водитель 2' },
  { id: 'driver3', name: 'Водитель 3' }
];

// Section configurations
export const SECTIONS = {
  greenhouse: {
    id: 'greenhouse',
    name: 'Теплицы',
    namePl: 'Szklarnie',
    icon: Warehouse,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    endpoint: '/api/greenhouse/orders',
    markerColor: '#16a34a'
  },
  balia: {
    id: 'balia',
    name: 'Купели',
    namePl: 'Balie',
    icon: Waves,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    endpoint: '/api/orders',
    markerColor: '#2563eb'
  },
  sauna: {
    id: 'sauna',
    name: 'Сауны',
    namePl: 'Sauny',
    icon: Flame,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    endpoint: '/api/sauna/orders',
    markerColor: '#ea580c'
  }
};

// Helper functions
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

// Get marker color based on order state
export const getMarkerColor = (order) => {
  if (order.isImportant) return '#ef4444'; // Red for important
  if (order.tripId) return '#9ca3af'; // Gray for in trip
  return '#22c55e'; // Green for free
};

// Get marker icon for order
export const getMarkerIcon = (order) => {
  const color = getMarkerColor(order);
  const isImportant = order.isImportant;
  
  if (isImportant && window.google) {
    // Exclamation mark icon for important
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
  
  if (window.google) {
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: 'white',
      strokeWeight: 2
    };
  }
  
  return null;
};

// Get unassigned orders
export const getUnassignedOrders = (orders) => {
  return orders.filter(o => !o.tripId);
};

// Get orders for map based on filter
export const getMapOrders = (orders, mapFilter) => {
  if (mapFilter === 'free') {
    return orders.filter(o => !o.tripId && o.lat && o.lng);
  }
  return orders.filter(o => o.lat && o.lng);
};
