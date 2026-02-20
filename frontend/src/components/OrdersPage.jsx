import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { FileDown, Eye, Package, Flame, Search, Trash2, Gift, Percent, UserCircle, Wrench, Download, Edit, Shield, Calculator, Globe } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { TechSpecModal } from './tech-spec';
import { OrderPreviewModal } from './OrderPreviewModal';
import { OrderFullEditModal } from './OrderFullEditModal';
import { OrderFilters, OrdersPagination, AssignUserDropdown } from './orders';
import { useOrdersFiltering } from '../hooks/useOrdersFiltering';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

export const OrdersPage = ({ calculatorType = 'balia', onEditInCalculator }) => {
  const { t, i18n } = useTranslation();
  const { isAdmin, canEdit, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Check if user can give gifts (admin or employee/manager)
  const canGiveGifts = canEdit && canEdit();
  
  // Tech Spec Modal state
  const [techSpecModalOpen, setTechSpecModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Preview Modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);
  
  // Edit Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);

  const isSauna = calculatorType === 'sauna';

  // Use filtering hook
  const {
    searchQuery,
    setSearchQuery,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    currentPage,
    setCurrentPage,
    filteredAndSortedOrders,
    paginatedOrders,
    totalPages,
    startIndex,
    endIndex,
    hasActiveFilters,
    clearFilters,
  } = useOrdersFiltering(orders);

  // Translations
  const texts = {
    ru: {
      ordersList: isSauna ? 'Заказы саун' : 'Список заказов',
      noOrders: isSauna ? 'Заказов саун пока нет' : 'Заказов пока нет',
      confirmDelete: 'Удалить этот заказ?',
      orderDeleted: 'Заказ удалён',
      noResults: 'Ничего не найдено',
      promo: 'Акция',
      gift: 'Подарок',
      discount: 'Скидка',
      createdBy: 'Сотрудник',
      preview: 'Просмотр',
      edit: 'Быстрое редактирование',
      editInCalculator: 'Редактировать в калькуляторе',
      adminDiscount: 'Скидка одобрена администратором',
      requestedDiscount: 'Запрошена скидка',
      deleteOrder: 'Удалить заказ',
    },
    pl: {
      ordersList: isSauna ? 'Zamówienia saun' : 'Lista zamówień',
      noOrders: isSauna ? 'Brak zamówień saun' : 'Brak zamówień',
      confirmDelete: 'Usunąć to zamówienie?',
      orderDeleted: 'Zamówienie usunięte',
      noResults: 'Nic nie znaleziono',
      promo: 'Promocja',
      gift: 'Prezent',
      discount: 'Rabat',
      createdBy: 'Pracownik',
      preview: 'Podgląd',
      edit: 'Szybka edycja',
      editInCalculator: 'Edytuj w kalkulatorze',
      adminDiscount: 'Rabat zatwierdzony przez administratora',
      requestedDiscount: 'Wnioskowany rabat',
      deleteOrder: 'Usuń zamówienie',
    },
  };
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Open preview modal
  const handlePreviewOrder = (order) => {
    setPreviewOrder(order);
    setPreviewModalOpen(true);
  };

  // Open edit modal (quick edit for customer data, discount, gifts)
  const handleEditOrder = (order) => {
    setEditOrder(order);
    setEditModalOpen(true);
  };
  
  // Open order in calculator for full editing (model, options change)
  const handleEditInCalculator = (order) => {
    if (onEditInCalculator) {
      onEditInCalculator(order);
    }
  };
  
  // Handle order saved from edit modal
  const handleOrderSaved = (updatedOrder) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  useEffect(() => {
    fetchOrders();
  }, [calculatorType, user]);

  const fetchOrders = async () => {
    try {
      let endpoint = isSauna ? `${API_URL}/api/sauna/orders` : `${API_URL}/api/orders`;
      
      // Add user filtering params (managers see only their orders)
      if (user?.username && user?.role) {
        endpoint += `?username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(user.role)}`;
      }
      
      const response = await axios.get(endpoint);
      // Filter out orders that were IMPORTED from amoCRM via webhook (source === 'amocrm')
      // BUT keep orders that were CREATED in calculator from amoCRM link (they have amocrm_id but no source='amocrm')
      const calculatorOrders = response.data.filter(o => o.source !== 'amocrm');
      setOrders(calculatorOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (order, type = 'customer') => {
    try {
      // For balia technical spec - use Excel production sheet
      if (!isSauna && type === 'technical') {
        const response = await axios.post(`${API_URL}/api/generate-production-excel`, 
          { ...order, orderId: order.id },
          { responseType: 'blob' }
        );
        
        let safeName = (order.fullName || 'Zamowienie').replace(/\s+/g, '_');
        safeName = safeName.replace(/[<>:"/\\|?*]/g, '');
        if (!safeName || safeName === '_') safeName = 'Zamowienie';
        const filename = `TechSpec_${safeName}_${order.id}.xlsx`;
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        toast.success(t('pdfGenerated'));
        return;
      }
      
      const endpoint = isSauna ? `${API_URL}/api/sauna/generate-pdf` : `${API_URL}/api/generate-pdf`;
      
      // For sauna orders, we need to fetch additional data for PDF page 2
      let pdfPayload = { ...order, orderId: order.id, type, language: 'pl' };
      
      if (isSauna) {
        try {
          // Fetch prices to get model variants and categories
          const pricesResponse = await axios.get(`${API_URL}/api/sauna/prices`);
          const prices = pricesResponse.data;
          
          // Get model data
          const model = prices.models?.find(m => m.id === order.selectedModel);
          
          // Collect model variants for page 2
          const modelVariantsData = model?.variants?.map(v => ({
            id: v.id,
            name: v.name,
            namePl: v.namePl,
            price: v.price,
            imageUrl: v.imageUrl,
            hint: v.hint,
            hintPl: v.hintPl,
            capacity: v.capacity,
            terraceSize: v.terraceSize,
            relaxRoomSize: v.relaxRoomSize,
            steamRoomSize: v.steamRoomSize,
            entranceSide: v.entranceSide,
          })) || [];
          
          // Get Plus-only categories
          const plusOnlyCategories = (prices.categories || [])
            .filter(cat => {
              const visibleFor = cat.visibleForModelVariants || [];
              if (visibleFor.length === 0) return false;
              return visibleFor.some(v => v.toLowerCase() === 'plus' || v.includes('plus'));
            })
            .map(cat => ({
              id: cat.id,
              name: cat.name,
              options: (cat.options || [])
                .filter(opt => opt.showInPdf !== false)
                .map(opt => ({
                  id: opt.id,
                  name: opt.name,
                  price: opt.price,
                  imageUrl: opt.imageUrl,
                  hint: opt.hint,
                }))
            }));
          
          // Get all available options for page 2 (filtered by model compatibility)
          const selectedModelId = order.selectedModel;
          const allAvailableOptions = (prices.categories || [])
            .filter(cat => {
              const visibleFor = cat.visibleForModelVariants || [];
              if (visibleFor.length > 0) return false;
              if (cat.id === 'fundament') return false;
              return true;
            })
            .flatMap(cat => (cat.options || [])
              .filter(opt => {
                // Skip options hidden from PDF
                if (opt.showInPdf === false) return false;
                
                // Skip options incompatible with selected model
                const incompatibleModels = opt.incompatibleModels || [];
                if (incompatibleModels.length > 0 && selectedModelId) {
                  if (incompatibleModels.includes(selectedModelId)) return false;
                }
                
                // Check showInPdfForModels if defined
                const showInPdfForModels = opt.showInPdfForModels || [];
                if (showInPdfForModels.length > 0 && selectedModelId) {
                  if (!showInPdfForModels.includes(selectedModelId)) return false;
                }
                
                return true;
              })
              .map(opt => ({
                id: opt.id,
                name: opt.name,
                price: opt.price,
                imageUrl: opt.imageUrl,
                hint: opt.hint,
                categoryName: cat.name,
              })));
          
          // Get selected model variant data
          const selectedVariant = model?.variants?.find(v => v.id === order.selectedModelVariant);
          let selectedModelVariantData = null;
          
          // Check for layout catalog selection stored in order
          let otherLayoutsForSize = [];
          if (order.selectedLayoutId && order.selectedLayoutSize) {
            // Fetch layout variants
            try {
              const layoutsResponse = await axios.get(`${API_URL}/api/faq/layout-variants`);
              const layoutVariants = layoutsResponse.data || [];
              
              const selectedLayoutFromCatalog = layoutVariants.find(l => 
                (l._id === order.selectedLayoutId || l.id === order.selectedLayoutId)
              );
              
              if (selectedLayoutFromCatalog) {
                // Build selectedModelVariantData from layout catalog
                selectedModelVariantData = {
                  imageUrl: selectedLayoutFromCatalog.imageUrl,
                  name: selectedLayoutFromCatalog.variantName,
                  namePl: selectedLayoutFromCatalog.variantName,
                  capacity: selectedLayoutFromCatalog.peopleCount,
                  terraceSize: selectedLayoutFromCatalog.terraceSize,
                  relaxRoomSize: selectedLayoutFromCatalog.relaxRoomSize,
                  steamRoomSize: selectedLayoutFromCatalog.steamRoomSize,
                  entranceSide: selectedLayoutFromCatalog.entranceSide,
                  hint: selectedLayoutFromCatalog.description,
                };
                
                // Get other layouts for the same size
                otherLayoutsForSize = layoutVariants
                  .filter(l => l.modelSize === order.selectedLayoutSize && 
                    (l._id !== order.selectedLayoutId && l.id !== order.selectedLayoutId))
                  .map(l => ({
                    id: l._id || l.id,
                    name: l.variantName,
                    imageUrl: l.imageUrl,
                    description: l.description,
                    peopleCount: l.peopleCount,
                    terraceSize: l.terraceSize,
                    relaxRoomSize: l.relaxRoomSize,
                    steamRoomSize: l.steamRoomSize,
                    entranceSide: l.entranceSide,
                  }));
              }
            } catch (e) {
              console.error('Failed to fetch layout variants:', e);
            }
          }
          
          // If no layout from catalog, use model variant
          if (!selectedModelVariantData && selectedVariant) {
            selectedModelVariantData = {
              imageUrl: selectedVariant.imageUrl,
              name: selectedVariant.namePl || selectedVariant.name,
              namePl: selectedVariant.namePl,
              capacity: selectedVariant.capacity,
              terraceSize: selectedVariant.terraceSize,
              relaxRoomSize: selectedVariant.relaxRoomSize,
              steamRoomSize: selectedVariant.steamRoomSize,
              entranceSide: selectedVariant.entranceSide,
              hint: selectedVariant.hintPl || selectedVariant.hint,
            };
          }
          
          // PDF Page 2 settings
          const pdfPage2Settings = {
            pdfPage2Enabled: prices.pdfPage2Enabled !== false,
            pdfPage2VariantsTitle: prices.pdfPage2VariantsTitle || 'Możliwe warianty wykonania w wybranym rozmiarze',
            pdfPage2OptionsTitle: prices.pdfPage2OptionsTitle || 'Opcje, które można dodać do sauny',
            pdfPage2ShowVariants: prices.pdfPage2ShowVariants !== false,
            pdfPage2ShowComparisonTable: prices.pdfPage2ShowComparisonTable !== false,
            pdfPage2ShowPlusCategories: prices.pdfPage2ShowPlusCategories !== false,
            pdfPage2ShowAllOptions: prices.pdfPage2ShowAllOptions !== false,
          };
          
          pdfPayload = {
            ...pdfPayload,
            categories: prices.categories,
            modelVariants: modelVariantsData,
            plusOnlyCategories,
            allAvailableOptions,
            selectedModelVariantData,
            otherLayoutsForSize,
            selectedLayoutSize: order.selectedLayoutSize,
            ...pdfPage2Settings,
          };
        } catch (e) {
          console.error('Failed to fetch additional PDF data:', e);
          // Continue with basic payload
        }
      }
      
      const response = await axios.post(endpoint, pdfPayload, { responseType: 'blob' });

      // Generate filename: TYPE_ClientName_OrderId
      let safeName = (order.fullName || 'Klient').replace(/\s+/g, '_');
      safeName = safeName.replace(/[<>:"/\\|?*]/g, '');
      if (!safeName || safeName === '_') safeName = 'Klient';
      const prefix = isSauna ? 'SAUNA' : 'BALIA';
      const filename = `${prefix}_${safeName}_${order.id}.pdf`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(t('pdfGenerated'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('error'));
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm(txt.confirmDelete)) return;
    
    try {
      const endpoint = isSauna 
        ? `${API_URL}/api/sauna/orders/${orderId}` 
        : `${API_URL}/api/orders/${orderId}`;
      await axios.delete(endpoint);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast.success(txt.orderDeleted);
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(t('error'));
    }
  };

  // Open Tech Spec Modal
  const handleOpenTechSpec = (order) => {
    setSelectedOrder(order);
    setTechSpecModalOpen(true);
  };

  // Download existing Tech Spec PDF
  const handleDownloadTechSpec = async (order) => {
    try {
      const techSpec = order.techSpec || {};
      const response = await axios.post(
        `${API_URL}/api/sauna/generate-tech-spec-pdf`,
        { order, techSpec },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TechSpec_${order.id}_${order.fullName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('PDF скачан!');
    } catch (error) {
      console.error('Error downloading tech spec:', error);
      toast.error(t('error'));
    }
  };

  // Callback when tech spec is saved
  const handleTechSpecSaved = (techSpecData) => {
    setOrders(prev => prev.map(o => 
      o.id === selectedOrder?.id ? { ...o, techSpec: techSpecData } : o
    ));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const Icon = isSauna ? Flame : Package;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card className="shadow-lg" data-testid="orders-page-card">
        <CardHeader className={`bg-gradient-to-br ${isSauna ? 'from-green-500/10 to-emerald-500/10' : 'from-primary/5 to-accent/5'}`}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Icon className={`h-6 w-6 ${isSauna ? 'text-green-600' : 'text-primary'}`} />
                {txt.ordersList}
              </CardTitle>
              <Badge variant="secondary" className="text-lg px-3 py-1" data-testid="orders-count-badge">
                {filteredAndSortedOrders.length}
              </Badge>
            </div>
            
            {/* Filters */}
            <OrderFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('loading')}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Icon className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">{txt.noOrders}</p>
            </div>
          ) : filteredAndSortedOrders.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">{txt.noResults}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('orderNumber')}</TableHead>
                    <TableHead>{t('customer')}</TableHead>
                    {isSauna && <TableHead>Model</TableHead>}
                    {isSauna && <TableHead>{txt.promo}</TableHead>}
                    <TableHead>{txt.createdBy}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="text-right">{t('total')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order, index) => (
                    <TableRow 
                      key={order.id || index} 
                      data-testid={`order-row-${order.id}`}
                      className={order.source === 'web' || order.source === 'website' ? 'bg-blue-50/50' : ''}
                    >
                      <TableCell className="font-medium font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {(order.source === 'web' || order.source === 'website') && (
                            <Globe className="h-4 w-4 text-blue-500" title={i18n.language === 'pl' ? 'Z internetu' : 'Из интернета'} />
                          )}
                          {order.id || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.fullName}</p>
                          <p className="text-sm text-muted-foreground">{order.phoneNumber}</p>
                        </div>
                      </TableCell>
                      {isSauna && (
                        <TableCell>
                          <p className="text-sm">{order.modelName || '-'}</p>
                        </TableCell>
                      )}
                      {isSauna && (
                        <TableCell className="text-center">
                          {order.discountPercent > 0 ? (
                            <div 
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600" 
                              title={`${txt.discount} ${order.discountPercent}%`}
                            >
                              <Percent className="h-4 w-4" />
                            </div>
                          ) : (
                            <div 
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-600" 
                              title={txt.gift}
                            >
                              <Gift className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {isAdmin && isAdmin() ? (
                          <AssignUserDropdown
                            order={order}
                            currentUser={user}
                            isSauna={isSauna}
                            lang={lang}
                            onAssigned={(updatedOrder) => {
                              setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                            }}
                          />
                        ) : order.createdBy ? (
                          <div className="flex items-center gap-1 text-sm">
                            <UserCircle className="h-4 w-4 text-muted-foreground" />
                            <span>{order.createdBy}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <div className="flex items-center justify-end gap-1">
                          {/* Show shield if admin approved, otherwise show request icon if there's a requested discount */}
                          {order.adminDiscountApproved ? (
                            <Shield className="h-4 w-4 text-green-600" title={txt.adminDiscount} />
                          ) : order.requestedDiscount > 0 ? (
                            <Percent className="h-4 w-4 text-amber-500 animate-pulse" title={`${txt.requestedDiscount}: ${order.requestedDiscount}%`} />
                          ) : null}
                          {(order.adminGifts?.length > 0) && (
                            <Gift className="h-4 w-4 text-green-600" title={txt.gift} />
                          )}
                          {isSauna 
                            ? `${(order.total || 0).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN`
                            : `${(order.total || 0).toFixed(2)}€`
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {/* Preview Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreviewOrder(order)}
                            title={txt.preview}
                            data-testid={`preview-btn-${order.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Edit in Calculator Button - Available to all employees */}
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleEditInCalculator(order)}
                            title={txt.editInCalculator}
                            data-testid={`edit-calculator-btn-${order.id}`}
                          >
                            <Calculator className="h-4 w-4 mr-1" />
                            {lang === 'pl' ? 'Edytuj' : 'Редактировать'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(order, 'customer')}
                            data-testid={`download-pdf-btn-${order.id}`}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            {t('downloadPDF')}
                          </Button>
                          {isSauna && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenTechSpec(order)}
                                title="Создать/редактировать тех.задание"
                                data-testid={`tech-spec-btn-${order.id}`}
                              >
                                <Wrench className="h-4 w-4 mr-1" />
                                Тех.Задание
                              </Button>
                              {order.techSpec && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadTechSpec(order)}
                                  title="Скачать тех.задание PDF"
                                  data-testid={`download-techspec-btn-${order.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                          {!isSauna && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownloadPDF(order, 'technical')}
                              data-testid={`download-technical-btn-${order.id}`}
                            >
                              <FileDown className="h-4 w-4 mr-1" />
                              {t('downloadTechnical')}
                            </Button>
                          )}
                          {isAdmin && isAdmin() && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteOrder(order.id)}
                              title={txt.deleteOrder}
                              data-testid={`delete-btn-${order.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <OrdersPagination
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalCount={filteredAndSortedOrders.length}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tech Spec Modal */}
      {isSauna && (
        <TechSpecModal
          open={techSpecModalOpen}
          onOpenChange={setTechSpecModalOpen}
          order={selectedOrder}
          onSaved={handleTechSpecSaved}
        />
      )}

      {/* Order Preview Modal */}
      <OrderPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        order={previewOrder}
        calculatorType={calculatorType}
      />
      
      {/* Order Full Edit Modal */}
      <OrderFullEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        order={editOrder}
        calculatorType={calculatorType}
        onSaved={handleOrderSaved}
      />
    </div>
  );
};
