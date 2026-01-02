import { useState, useEffect, useMemo } from 'react';

/**
 * Hook for filtering, sorting and paginating orders
 * @param {Array} orders - Array of orders to filter
 * @param {Object} options - Configuration options
 * @param {number} options.ordersPerPage - Number of orders per page (default: 10)
 */
export const useOrdersFiltering = (orders, options = {}) => {
  const { ordersPerPage = 10 } = options;
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Extract timestamp from order ID or fallback fields
  const extractTimestamp = (order) => {
    const id = order.id || '';
    // Check for WMS/WMB format: WMS-31-12-2025-161128
    const match = id.match(/WM[SB]-(\d{2})-(\d{2})-(\d{4})-(\d{6})/);
    if (match) {
      const [, day, month, year, time] = match;
      const hours = time.substring(0, 2);
      const minutes = time.substring(2, 4);
      const seconds = time.substring(4, 6);
      return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`).getTime();
    }
    // Fallback to createdAt or orderDate
    if (order.createdAt) return new Date(order.createdAt).getTime();
    if (order.orderDate) return new Date(order.orderDate).getTime();
    return 0;
  };
  
  // Filter and sort orders
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];
    
    // Apply type filter (if orders have _type field)
    if (typeFilter !== 'all') {
      result = result.filter(order => order._type === typeFilter);
    }
    
    // Apply text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const queryNormalized = query.replace(/\s+/g, '');
      result = result.filter(order => {
        const orderId = (order.id || '').toLowerCase();
        const fullName = (order.fullName || '').toLowerCase();
        const phoneNumber = (order.phoneNumber || '').replace(/\s+/g, '').toLowerCase();
        return orderId.includes(query) || fullName.includes(query) || phoneNumber.includes(queryNormalized);
      });
    }
    
    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter(order => {
        const orderDate = new Date(order.orderDate || order.createdAt);
        return orderDate >= fromDate;
      });
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(order => {
        const orderDate = new Date(order.orderDate || order.createdAt);
        return orderDate <= toDate;
      });
    }
    
    // Sort by creation time - newest first
    result.sort((a, b) => {
      const timeA = extractTimestamp(a);
      const timeB = extractTimestamp(b);
      return timeB - timeA;
    });
    
    return result;
  }, [orders, searchQuery, dateFrom, dateTo, typeFilter]);
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedOrders.length / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const paginatedOrders = filteredAndSortedOrders.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFrom, dateTo, typeFilter]);
  
  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setTypeFilter('all');
    setCurrentPage(1);
  };
  
  // Check if any filter is active
  const hasActiveFilters = searchQuery || dateFrom || dateTo || typeFilter !== 'all';
  
  return {
    // Filter state and setters
    searchQuery,
    setSearchQuery,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    typeFilter,
    setTypeFilter,
    
    // Pagination state and setters
    currentPage,
    setCurrentPage,
    
    // Computed values
    filteredAndSortedOrders,
    paginatedOrders,
    totalPages,
    startIndex,
    endIndex,
    ordersPerPage,
    hasActiveFilters,
    
    // Actions
    clearFilters,
  };
};

export default useOrdersFiltering;
