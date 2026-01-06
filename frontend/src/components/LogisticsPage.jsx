import React from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  MapPin, Route, Truck, Clock, Navigation, RefreshCw, ChevronDown, ChevronUp,
  Package, Plus, User, Phone, FileText, X, Hash, CheckCircle, Send,
  Users, Trash2, Settings, GripVertical, Sparkles, ArrowUp, ArrowDown,
  ExternalLink, DollarSign, MessageSquare, AlertCircle, Filter, Eye, Warehouse,
  Calendar, Printer
} from 'lucide-react';
import { 
  useLogistics, 
  SECTIONS, 
  DELIVERY_STATUSES, 
  TRIP_STATUSES, 
  ORDER_TRIP_STATUSES,
  TRIP_TO_ORDER_STATUS,
  mapContainerStyle,
  defaultCenter,
  formatDistance,
  formatDuration
} from './logistics';

export const LogisticsPage = () => {
  const {
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
    creatingTrip,
    optimizingRoute,
    draggedOrderIndex,
    tripDirections,
    tripRouteInfo,
    buildingTripRoute,
    tripStatusFilter,
    setTripStatusFilter,
    drivers,
    showDriversModal,
    setShowDriversModal,
    newDriverName,
    setNewDriverName,
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
    showOrderForm,
    setShowOrderForm,
    newOrderForm,
    setNewOrderForm,
    creatingOrder,
    editingAddressOrderId,
    editingAddressValue,
    setEditingAddressValue,
    editAddressInputRef,
    mapRef,
    tripMapRef,
    addressInputRef,
    warehouseInputRef,
    autocompleteRef,
    fetchAllOrders,
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
    formatDate
  } = useLogistics();

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
          <Button variant="outline" onClick={() => setShowSettingsModal(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Настройки
          </Button>
          <Button variant="outline" onClick={() => setShowDriversModal(true)}>
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <Card className="border-2 border-[#355c7d]/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Настройки логистики
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowSettingsModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-orange-600" />
                Адрес склада (начальная и конечная точка маршрута)
              </Label>
              <Input
                ref={warehouseInputRef}
                value={warehouseAddress}
                onChange={(e) => setWarehouseAddress(e.target.value)}
                placeholder="Введите адрес склада..."
                data-testid="warehouse-address-input"
              />
              {warehouseCoords && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Координаты: {warehouseCoords.lat.toFixed(5)}, {warehouseCoords.lng.toFixed(5)}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowSettingsModal(false)}>Отмена</Button>
              <Button 
                onClick={saveWarehouseSettings}
                disabled={savingSettings || !warehouseAddress.trim()}
                className="bg-[#355c7d] hover:bg-[#2a4a63]"
              >
                {savingSettings ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Сохранить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Bulk Actions Bar */}
      {currentData.selectedOrders.length > 0 && (
        <Card className="border-2 border-amber-500/50 bg-amber-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  Выбрано: {currentData.selectedOrders.length}
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
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
                <Select onValueChange={(driverId) => {
                  const driver = drivers.find(d => d.id === driverId);
                  if (driver) bulkUpdateOrders({ driverId, driverName: driver.name });
                }}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Водитель" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не назначен</SelectItem>
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
                <Button variant="outline" size="sm" onClick={clearRoute}>
                  Сбросить выбор
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          {Object.entries(SECTIONS).map(([key, section]) => {
            const Icon = section.icon;
            const unassignedCount = getUnassignedOrders(sectionData[key].orders).length;
            const sectionTripsCount = trips.filter(t => t.section === key).length;
            return (
              <TabsTrigger key={key} value={key} className={`gap-2 data-[state=active]:${section.bgColor}`}>
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
            {/* Inner Tabs */}
            <div className="mb-4">
              <div className="flex gap-2 border-b">
                <button
                  onClick={() => setActiveInnerTab('orders')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeInnerTab === 'orders' 
                      ? 'border-[#355c7d] text-[#355c7d]' 
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
                  <OrderForm 
                    currentSection={currentSection}
                    SectionIcon={SectionIcon}
                    newOrderForm={newOrderForm}
                    setNewOrderForm={setNewOrderForm}
                    addressInputRef={addressInputRef}
                    creatingOrder={creatingOrder}
                    handleCreateOrder={handleCreateOrder}
                    setShowOrderForm={setShowOrderForm}
                    autocompleteRef={autocompleteRef}
                  />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Orders List */}
                  <OrdersListCard
                    sectionKey={sectionKey}
                    currentSection={currentSection}
                    SectionIcon={SectionIcon}
                    sectionData={sectionData}
                    setSectionData={setSectionData}
                    currentData={currentData}
                    loading={loading}
                    expandedOrder={expandedOrder}
                    setExpandedOrder={setExpandedOrder}
                    editingAddressOrderId={editingAddressOrderId}
                    editingAddressValue={editingAddressValue}
                    setEditingAddressValue={setEditingAddressValue}
                    editAddressInputRef={editAddressInputRef}
                    drivers={drivers}
                    toggleOrderSelection={toggleOrderSelection}
                    toggleOrderImportant={toggleOrderImportant}
                    startEditingAddress={startEditingAddress}
                    saveEditedAddress={saveEditedAddress}
                    cancelEditingAddress={cancelEditingAddress}
                    updateOrderField={updateOrderField}
                    updateDeliveryStatus={updateDeliveryStatus}
                    deleteOrder={deleteOrder}
                    getUnassignedOrders={getUnassignedOrders}
                    setShowCreateTripModal={setShowCreateTripModal}
                    setShowAddToTripModal={setShowAddToTripModal}
                    trips={trips}
                    formatDate={formatDate}
                    DELIVERY_STATUSES={DELIVERY_STATUSES}
                  />

                  {/* Map */}
                  <OrdersMapCard
                    sectionKey={sectionKey}
                    currentSection={currentSection}
                    sectionData={sectionData}
                    setSectionData={setSectionData}
                    isLoaded={isLoaded}
                    mapFilter={mapFilter}
                    setMapFilter={setMapFilter}
                    mapFilterTripId={mapFilterTripId}
                    setMapFilterTripId={setMapFilterTripId}
                    trips={trips}
                    warehouseCoords={warehouseCoords}
                    warehouseAddress={warehouseAddress}
                    buildingRoute={buildingRoute}
                    buildRoute={buildRoute}
                    clearRoute={clearRoute}
                    openInGoogleMaps={openInGoogleMaps}
                    onMapLoad={onMapLoad}
                    getMapOrders={getMapOrders}
                    getMarkerIcon={getMarkerIcon}
                    formatDistance={formatDistance}
                    formatDuration={formatDuration}
                  />
                </div>
              </>
            )}

            {/* Trips View */}
            {activeInnerTab === 'trips' && (
              <TripsView
                sectionKey={sectionKey}
                currentSection={currentSection}
                trips={trips}
                selectedTrip={selectedTrip}
                setSelectedTrip={setSelectedTrip}
                tripStatusFilter={tripStatusFilter}
                setTripStatusFilter={setTripStatusFilter}
                sectionData={sectionData}
                drivers={drivers}
                isLoaded={isLoaded}
                warehouseCoords={warehouseCoords}
                warehouseAddress={warehouseAddress}
                tripDirections={tripDirections}
                tripRouteInfo={tripRouteInfo}
                buildingTripRoute={buildingTripRoute}
                optimizingRoute={optimizingRoute}
                draggedOrderIndex={draggedOrderIndex}
                tripMapRef={tripMapRef}
                updateTrip={updateTrip}
                updateTripStatus={updateTripStatus}
                syncTripToAmocrm={syncTripToAmocrm}
                syncingToAmocrm={syncingToAmocrm}
                deleteTrip={deleteTrip}
                optimizeTripRoute={optimizeTripRoute}
                updateOrderStatusInTrip={updateOrderStatusInTrip}
                removeOrderFromTrip={removeOrderFromTrip}
                moveOrderUp={moveOrderUp}
                moveOrderDown={moveOrderDown}
                handleDragStart={handleDragStart}
                handleDragOver={handleDragOver}
                handleDrop={handleDrop}
                handleDragEnd={handleDragEnd}
                setActiveInnerTab={setActiveInnerTab}
                formatDistance={formatDistance}
                formatDuration={formatDuration}
                TRIP_STATUSES={TRIP_STATUSES}
                ORDER_TRIP_STATUSES={ORDER_TRIP_STATUSES}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Trip Modal */}
      {showCreateTripModal && (
        <CreateTripModal
          currentSection={currentSection}
          currentData={currentData}
          drivers={drivers}
          newTripName={newTripName}
          setNewTripName={setNewTripName}
          newTripDriver={newTripDriver}
          setNewTripDriver={setNewTripDriver}
          creatingTrip={creatingTrip}
          createTrip={createTrip}
          setShowCreateTripModal={setShowCreateTripModal}
        />
      )}

      {/* Add to Existing Trip Modal */}
      {showAddToTripModal && (
        <AddToTripModal
          currentSection={currentSection}
          currentData={currentData}
          trips={trips}
          activeSection={activeSection}
          drivers={drivers}
          addToTripId={addToTripId}
          setAddToTripId={setAddToTripId}
          addingToTrip={addingToTrip}
          addOrdersToTrip={addOrdersToTrip}
          setShowAddToTripModal={setShowAddToTripModal}
          TRIP_STATUSES={TRIP_STATUSES}
        />
      )}
    </div>
  );
};

// Sub-components

const OrderForm = ({ 
  currentSection, SectionIcon, newOrderForm, setNewOrderForm, 
  addressInputRef, creatingOrder, handleCreateOrder, setShowOrderForm, autocompleteRef 
}) => (
  <Card className={`border-2 ${currentSection.borderColor}/30 ${currentSection.bgColor}/10 mb-6`}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <SectionIcon className={`h-5 w-5 ${currentSection.color}`} />
          Новый заказ - {currentSection.name.ru}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => { setShowOrderForm(false); autocompleteRef.current = null; }}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Имя клиента *
          </Label>
          <Input
            value={newOrderForm.fullName}
            onChange={(e) => setNewOrderForm(prev => ({ ...prev, fullName: e.target.value }))}
            placeholder="Введите имя"
            data-testid="order-form-name"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Телефон
          </Label>
          <Input
            type="tel"
            value={newOrderForm.phoneNumber}
            onChange={(e) => setNewOrderForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
            placeholder="+48 123 456 789"
            data-testid="order-form-phone"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Адрес доставки *
          </Label>
          <Input
            ref={addressInputRef}
            value={newOrderForm.fullAddress}
            onChange={(e) => setNewOrderForm(prev => ({ ...prev, fullAddress: e.target.value }))}
            placeholder="Введите адрес..."
            data-testid="order-form-address"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Состав заказа
          </Label>
          <Textarea
            value={newOrderForm.orderComposition}
            onChange={(e) => setNewOrderForm(prev => ({ ...prev, orderComposition: e.target.value }))}
            placeholder="Опишите состав заказа..."
            rows={3}
            data-testid="order-form-composition"
          />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button
            onClick={handleCreateOrder}
            disabled={creatingOrder || !newOrderForm.fullName || !newOrderForm.fullAddress}
            className="bg-[#355c7d] hover:bg-[#2a4a63]"
            data-testid="order-form-submit"
          >
            {creatingOrder ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Создать заказ
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

const OrdersListCard = ({
  sectionKey, currentSection, SectionIcon, sectionData, setSectionData, currentData, loading,
  expandedOrder, setExpandedOrder, editingAddressOrderId, editingAddressValue, setEditingAddressValue,
  editAddressInputRef, drivers, toggleOrderSelection, toggleOrderImportant, startEditingAddress,
  saveEditedAddress, cancelEditingAddress, updateOrderField, updateDeliveryStatus, deleteOrder,
  getUnassignedOrders, setShowCreateTripModal, setShowAddToTripModal, trips, formatDate, DELIVERY_STATUSES
}) => {
  // Check if there are active trips available
  const hasActiveTrips = trips.some(t => 
    t.section === sectionKey && 
    (t.status === 'planned' || t.status === 'in_transit')
  );
  
  return (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <SectionIcon className={`h-5 w-5 ${currentSection.color}`} />
          {currentSection.name.ru} (без рейса)
        </CardTitle>
        <div className="flex items-center gap-2">
          {currentData.selectedOrders.length > 0 && (
            <>
              {hasActiveTrips && (
                <Button 
                  size="sm" 
                  onClick={() => setShowAddToTripModal(true)} 
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="add-to-trip-btn"
                >
                  <Truck className="h-4 w-4 mr-1" />
                  В рейс ({currentData.selectedOrders.length})
                </Button>
              )}
              <Button size="sm" onClick={() => setShowCreateTripModal(true)} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-1" />
                Создать рейс ({currentData.selectedOrders.length})
              </Button>
            </>
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
        <p className="text-center text-muted-foreground py-8">Нет заказов без рейса</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {getUnassignedOrders(sectionData[sectionKey].orders).map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              sectionKey={sectionKey}
              currentSection={currentSection}
              sectionData={sectionData}
              expandedOrder={expandedOrder}
              setExpandedOrder={setExpandedOrder}
              editingAddressOrderId={editingAddressOrderId}
              editingAddressValue={editingAddressValue}
              setEditingAddressValue={setEditingAddressValue}
              editAddressInputRef={editAddressInputRef}
              drivers={drivers}
              toggleOrderSelection={toggleOrderSelection}
              toggleOrderImportant={toggleOrderImportant}
              startEditingAddress={startEditingAddress}
              saveEditedAddress={saveEditedAddress}
              cancelEditingAddress={cancelEditingAddress}
              updateOrderField={updateOrderField}
              updateDeliveryStatus={updateDeliveryStatus}
              deleteOrder={deleteOrder}
              formatDate={formatDate}
              DELIVERY_STATUSES={DELIVERY_STATUSES}
            />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
};

const OrderCard = ({
  order, sectionKey, currentSection, sectionData, expandedOrder, setExpandedOrder,
  editingAddressOrderId, editingAddressValue, setEditingAddressValue, editAddressInputRef,
  drivers, toggleOrderSelection, toggleOrderImportant, startEditingAddress, saveEditedAddress,
  cancelEditingAddress, updateOrderField, updateDeliveryStatus, deleteOrder, formatDate, DELIVERY_STATUSES
}) => {
  const status = DELIVERY_STATUSES[order.deliveryStatus] || DELIVERY_STATUSES.pending;
  const StatusIcon = status.icon;
  const isSelected = sectionData[sectionKey].selectedOrders.includes(order.id);

  return (
    <div className={`p-3 border rounded-lg transition-colors ${isSelected ? `${currentSection.bgColor} ${currentSection.borderColor}` : 'hover:bg-muted/50'}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleOrderSelection(order.id)}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium truncate">{order.fullName || order.customerName}</p>
            <div className="flex items-center gap-1">
              <Badge className={`${status.color} text-xs gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                {expandedOrder === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => deleteOrder(order.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Address */}
          {editingAddressOrderId === order.id ? (
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <Input
                ref={editAddressInputRef}
                value={editingAddressValue}
                onChange={(e) => setEditingAddressValue(e.target.value)}
                placeholder="Введите адрес..."
                className="h-7 text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); saveEditedAddress(order.id); }
                  else if (e.key === 'Escape') { cancelEditingAddress(); }
                }}
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveEditedAddress(order.id)}>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEditingAddress}>
                <X className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-1 group">
              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span 
                className="text-sm text-muted-foreground truncate cursor-pointer hover:text-foreground"
                onClick={() => startEditingAddress(order.id, order.fullAddress || order.address)}
                title="Нажмите, чтобы изменить адрес"
              >
                {order.fullAddress || order.address || 'Нет адреса — нажмите для добавления'}
              </span>
              <Button size="sm" variant="ghost" className="h-5 px-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEditingAddress(order.id, order.fullAddress || order.address)}>
                <FileText className="h-3 w-3" />
              </Button>
              {(order.lat && order.lng) ? (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 whitespace-nowrap">✓ на карте</span>
              ) : (order.fullAddress || order.address) ? (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 whitespace-nowrap">⏳ геокодинг</span>
              ) : (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">нет адреса</span>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{formatDate(order.orderDate || order.createdAt)}</span>
            {order.routeNumber && <Badge variant="outline" className="text-xs py-0 px-1"><Hash className="h-2 w-2 mr-1" />Рейс {order.routeNumber}</Badge>}
            {order.driverName && <Badge variant="outline" className="text-xs py-0 px-1"><User className="h-2 w-2 mr-1" />{order.driverName}</Badge>}
            {order.amocrm_id && <span className="text-purple-500">• amoCRM</span>}
          </div>
          
          {/* Trip data display */}
          {order.tripId && (
            <div className="flex flex-wrap items-center gap-2 mt-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                <Route className="h-3 w-3 mr-1" />
                {order.tripName || 'Рейс'}
              </Badge>
              {order.tripDriverName && (
                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700">
                  <User className="h-3 w-3 mr-1" />
                  {order.tripDriverName}
                </Badge>
              )}
              {order.tripDepartureDate && (
                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700">
                  <Calendar className="h-3 w-3 mr-1" />
                  {order.tripDepartureDate}
                </Badge>
              )}
              {order.tripOrderStatus && (
                <Badge className={`text-xs ${
                  order.tripOrderStatus === 'delivered' ? 'bg-green-100 text-green-700' :
                  order.tripOrderStatus === 'delivering' ? 'bg-yellow-100 text-yellow-700' :
                  order.tripOrderStatus === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {order.tripOrderStatus === 'delivered' ? 'Доставлен' :
                   order.tripOrderStatus === 'delivering' ? 'В пути' :
                   order.tripOrderStatus === 'cancelled' ? 'Отменён' :
                   'Ожидает'}
                </Badge>
              )}
            </div>
          )}
          
          {/* Important checkbox */}
          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id={`important-${order.id}`}
              checked={order.isImportant || false}
              onCheckedChange={() => toggleOrderImportant(order.id)}
              className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
            />
            <label htmlFor={`important-${order.id}`} className={`text-xs cursor-pointer flex items-center gap-1 ${order.isImportant ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
              <AlertCircle className={`h-3 w-3 ${order.isImportant ? 'text-red-500' : ''}`} />
              Важный заказ
            </label>
          </div>
          
          {/* Expanded details */}
          {expandedOrder === order.id && (
            <OrderExpandedDetails 
              order={order} 
              drivers={drivers} 
              updateOrderField={updateOrderField} 
              updateDeliveryStatus={updateDeliveryStatus}
              DELIVERY_STATUSES={DELIVERY_STATUSES}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const OrderExpandedDetails = ({ order, drivers, updateOrderField, updateDeliveryStatus, DELIVERY_STATUSES }) => (
  <div className="mt-3 pt-3 border-t space-y-3 text-sm">
    {order.amocrm_id && (
      <div className="bg-purple-50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-purple-700">Данные из amoCRM</span>
          {order.amocrm_link && (
            <a href={order.amocrm_link} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Открыть в amoCRM
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {order.orderNumber && <div><span className="text-muted-foreground">№ заказа:</span><span className="ml-1 font-medium">{order.orderNumber}</span></div>}
          {order.dealSum && <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-600" /><span className="text-muted-foreground">Сумма:</span><span className="ml-1 font-medium">{order.dealSum}</span></div>}
          {order.debtSum && <div className="text-red-600"><span className="text-muted-foreground">Долг:</span><span className="ml-1 font-medium">{order.debtSum}</span></div>}
        </div>
        {order.orderContents && <div className="text-xs"><span className="text-muted-foreground">Состав:</span><p className="mt-1 p-2 bg-white rounded border text-xs whitespace-pre-wrap">{order.orderContents}</p></div>}
        {order.orderComment && <div className="text-xs"><span className="text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />Комментарий:</span><p className="mt-1 p-2 bg-white rounded border text-xs">{order.orderComment}</p></div>}
      </div>
    )}

    {order.phoneNumber && (
      <p className="flex items-center gap-2">
        <Phone className="h-3 w-3" />
        <a href={`tel:${order.phoneNumber}`} className="text-blue-600 hover:underline">{order.phoneNumber}</a>
      </p>
    )}
    {order.notes && !order.amocrm_id && (
      <p className="flex items-start gap-2"><FileText className="h-3 w-3 mt-0.5" /><span className="break-words">{order.notes}</span></p>
    )}
    
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
            updateOrderField(order.id, { driverId: value === 'none' ? '' : value, driverName: driver?.name || '' });
          }}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Выбрать" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Не назначен</SelectItem>
            {drivers.map(driver => <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
    
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Статус доставки</Label>
      <Select value={order.deliveryStatus || 'pending'} onValueChange={(value) => updateDeliveryStatus(order.id, value, order.deliveryComment || '')}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(DELIVERY_STATUSES).map(([key, val]) => {
            const Icon = val.icon;
            return <SelectItem key={key} value={key}><div className="flex items-center gap-2"><Icon className="h-3 w-3" />{val.label}</div></SelectItem>;
          })}
        </SelectContent>
      </Select>
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
      {order.amocrm_id && <p className="text-xs text-purple-500 flex items-center gap-1"><Send className="h-3 w-3" />Синхр. с amoCRM при изменении</p>}
    </div>
  </div>
);

const OrdersMapCard = ({
  sectionKey, currentSection, sectionData, setSectionData, isLoaded, mapFilter, setMapFilter,
  mapFilterTripId, setMapFilterTripId, trips,
  warehouseCoords, warehouseAddress, buildingRoute, buildRoute, clearRoute, openInGoogleMaps, 
  onMapLoad, getMapOrders, getMarkerIcon, formatDistance, formatDuration
}) => {
  const sectionTrips = trips?.filter(t => t.section === sectionKey) || [];
  
  return (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Карта
        </CardTitle>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button size="sm" variant={mapFilter === 'free' ? 'default' : 'ghost'} onClick={() => { setMapFilter('free'); setMapFilterTripId(null); }} className="h-7 text-xs">
              <Eye className="h-3 w-3 mr-1" />Свободные
            </Button>
            <Button size="sm" variant={mapFilter === 'all' ? 'default' : 'ghost'} onClick={() => { setMapFilter('all'); setMapFilterTripId(null); }} className="h-7 text-xs">
              <Filter className="h-3 w-3 mr-1" />Все
            </Button>
          </div>
          {/* Trip filter dropdown */}
          {sectionTrips.length > 0 && (
            <Select 
              value={mapFilter === 'free_plus_trip' ? mapFilterTripId || '' : ''} 
              onValueChange={(tripId) => {
                if (tripId) {
                  setMapFilter('free_plus_trip');
                  setMapFilterTripId(tripId);
                } else {
                  setMapFilter('free');
                  setMapFilterTripId(null);
                }
              }}
            >
              <SelectTrigger className="h-7 w-[180px] text-xs" data-testid="map-trip-filter">
                <Route className="h-3 w-3 mr-1" />
                <SelectValue placeholder="+ Рейс на карте" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без рейса</SelectItem>
                {sectionTrips.map(trip => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.name} ({trip.orderIds?.length || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {sectionData[sectionKey].selectedOrders.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={clearRoute}><X className="h-4 w-4 mr-1" />Сбросить</Button>
              <Button
                size="sm"
                onClick={buildRoute}
                disabled={buildingRoute || sectionData[sectionKey].selectedOrders.filter(id => {
                  const order = sectionData[sectionKey].orders.find(o => o.id === id);
                  return order && order.lat && order.lng;
                }).length < 2}
                className={`${currentSection.bgColor} ${currentSection.color} hover:opacity-90`}
              >
                {buildingRoute ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Route className="h-4 w-4 mr-1" />}
                Построить маршрут
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div><span>Свободные</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-400"></div><span>В рейсе</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div><span>Важные</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span>Склад</span></div>
        {mapFilter === 'free_plus_trip' && mapFilterTripId && (
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span>Выбранный рейс</span></div>
        )}
      </div>
      {sectionData[sectionKey].routeInfo && (
        <div className={`flex gap-4 mt-3 p-3 ${currentSection.bgColor}/50 rounded-lg`}>
          <div className="flex items-center gap-2"><Navigation className={`h-4 w-4 ${currentSection.color}`} /><span className="text-sm font-medium">{formatDistance(sectionData[sectionKey].routeInfo.distance)}</span></div>
          <div className="flex items-center gap-2"><Clock className={`h-4 w-4 ${currentSection.color}`} /><span className="text-sm font-medium">{formatDuration(sectionData[sectionKey].routeInfo.duration)}</span></div>
          <Button size="sm" variant="ghost" onClick={openInGoogleMaps} className="ml-auto"><Navigation className="h-4 w-4 mr-1" />Открыть в Google Maps</Button>
        </div>
      )}
    </CardHeader>
    <CardContent className="relative">
      {!isLoaded ? (
        <div className="flex items-center justify-center h-[500px] bg-muted rounded-lg"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={6}
          onLoad={onMapLoad}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
        >
          {getMapOrders(sectionData[sectionKey].orders).map((order) => {
            const isSelected = sectionData[sectionKey].selectedOrders.includes(order.id);
            const selectedIndex = isSelected ? sectionData[sectionKey].selectedOrders.indexOf(order.id) + 1 : null;
            const isInSelectedTrip = mapFilterTripId && order.tripId === mapFilterTripId;
            return (
              <Marker
                key={order.id}
                position={{ lat: order.lat, lng: order.lng }}
                title={`${order.fullName || order.customerName}\n${order.fullAddress || order.address}`}
                label={isSelected ? { text: String(selectedIndex), color: 'white', fontWeight: 'bold' } : undefined}
                icon={isSelected ? { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: currentSection.markerColor, fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 } : isInSelectedTrip ? { path: window.google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#9333ea', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 } : getMarkerIcon(order)}
                onClick={() => {
                  const currentSelected = sectionData[sectionKey].selectedOrders;
                  if (isSelected) {
                    setSectionData(prev => ({ ...prev, [sectionKey]: { ...prev[sectionKey], selectedOrders: currentSelected.filter(id => id !== order.id) } }));
                  } else {
                    setSectionData(prev => ({ ...prev, [sectionKey]: { ...prev[sectionKey], selectedOrders: [...currentSelected, order.id] } }));
                  }
                }}
              />
            );
          })}
          {warehouseCoords && warehouseCoords.lat && warehouseCoords.lng && (
            <Marker
              key="warehouse"
              position={{ lat: warehouseCoords.lat, lng: warehouseCoords.lng }}
              title={`Склад: ${warehouseAddress}`}
              icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#f97316', fillOpacity: 1, strokeColor: 'white', strokeWeight: 3 }}
              label={{ text: 'С', color: 'white', fontWeight: 'bold', fontSize: '11px' }}
            />
          )}
          {sectionData[sectionKey].directions && (
            <DirectionsRenderer
              directions={sectionData[sectionKey].directions}
              options={{ suppressMarkers: true, polylineOptions: { strokeColor: currentSection.markerColor, strokeWeight: 4, strokeOpacity: 0.8 } }}
            />
          )}
        </GoogleMap>
      )}
    </CardContent>
  </Card>
);
};

const TripsView = ({
  sectionKey, currentSection, trips, selectedTrip, setSelectedTrip, tripStatusFilter, setTripStatusFilter,
  sectionData, drivers, isLoaded, warehouseCoords, warehouseAddress, tripDirections, tripRouteInfo,
  buildingTripRoute, optimizingRoute, draggedOrderIndex, tripMapRef, updateTrip, updateTripStatus, 
  syncTripToAmocrm, syncingToAmocrm, deleteTrip,
  optimizeTripRoute, updateOrderStatusInTrip, removeOrderFromTrip, moveOrderUp, moveOrderDown,
  handleDragStart, handleDragOver, handleDrop, handleDragEnd, setActiveInnerTab,
  formatDistance, formatDuration, TRIP_STATUSES, ORDER_TRIP_STATUSES
}) => {
  const filteredTrips = trips.filter(t => t.section === sectionKey && (t.status || 'planned') === tripStatusFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Trips List */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Route className="h-4 w-4 text-purple-600" />
                Рейсы
              </CardTitle>
              <Badge variant="secondary" className="bg-purple-100 text-xs">{trips.filter(t => t.section === sectionKey).length}</Badge>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {Object.entries(TRIP_STATUSES).map(([statusKey, statusInfo]) => {
                const count = trips.filter(t => t.section === sectionKey && (t.status || 'planned') === statusKey).length;
                const StatusIcon = statusInfo.icon;
                return (
                  <Button key={statusKey} size="sm" variant={tripStatusFilter === statusKey ? 'default' : 'outline'} onClick={() => setTripStatusFilter(statusKey)} className={`h-7 text-xs ${tripStatusFilter === statusKey ? '' : statusInfo.color}`}>
                    <StatusIcon className="h-3 w-3 mr-1" />{statusInfo.label}<Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{count}</Badge>
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {filteredTrips.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-3">Нет рейсов в категории &quot;{TRIP_STATUSES[tripStatusFilter]?.label}&quot;</p>
                {tripStatusFilter === 'planned' && <Button size="sm" variant="outline" onClick={() => setActiveInnerTab('orders')}><Package className="h-3 w-3 mr-1" />Создать рейс</Button>}
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredTrips.map((trip) => (
                  <div key={trip.id} className={`p-2 border rounded-lg cursor-pointer transition-colors ${selectedTrip?.id === trip.id ? 'bg-purple-50 border-purple-300' : 'hover:bg-muted/50'}`} onClick={() => setSelectedTrip(trip)} data-testid={`trip-card-${trip.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{trip.name}</p>
                        <p className="text-xs text-muted-foreground">{trip.orderIds?.length || 0} заказов</p>
                        {trip.driverName && <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5"><User className="h-3 w-3" />{trip.driverName}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trip Details */}
      <div className="lg:col-span-4">
        <TripDetailsCard
          selectedTrip={selectedTrip}
          setSelectedTrip={setSelectedTrip}
          sectionKey={sectionKey}
          sectionData={sectionData}
          drivers={drivers}
          tripRouteInfo={tripRouteInfo}
          optimizingRoute={optimizingRoute}
          draggedOrderIndex={draggedOrderIndex}
          updateTrip={updateTrip}
          updateTripStatus={updateTripStatus}
          syncTripToAmocrm={syncTripToAmocrm}
          syncingToAmocrm={syncingToAmocrm}
          deleteTrip={deleteTrip}
          optimizeTripRoute={optimizeTripRoute}
          updateOrderStatusInTrip={updateOrderStatusInTrip}
          removeOrderFromTrip={removeOrderFromTrip}
          moveOrderUp={moveOrderUp}
          moveOrderDown={moveOrderDown}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleDragEnd={handleDragEnd}
          formatDistance={formatDistance}
          formatDuration={formatDuration}
          TRIP_STATUSES={TRIP_STATUSES}
          ORDER_TRIP_STATUSES={ORDER_TRIP_STATUSES}
        />
      </div>

      {/* Trip Map */}
      <div className="lg:col-span-5">
        <TripMapCard
          selectedTrip={selectedTrip}
          sectionData={sectionData}
          isLoaded={isLoaded}
          warehouseCoords={warehouseCoords}
          warehouseAddress={warehouseAddress}
          tripDirections={tripDirections}
          buildingTripRoute={buildingTripRoute}
          tripMapRef={tripMapRef}
        />
      </div>
    </div>
  );
};

const TripDetailsCard = ({
  selectedTrip, setSelectedTrip, sectionKey, sectionData, drivers, tripRouteInfo, optimizingRoute,
  draggedOrderIndex, updateTrip, updateTripStatus, syncTripToAmocrm, syncingToAmocrm, deleteTrip, optimizeTripRoute, updateOrderStatusInTrip,
  removeOrderFromTrip, moveOrderUp, moveOrderDown, handleDragStart, handleDragOver, handleDrop,
  handleDragEnd, formatDistance, formatDuration, TRIP_STATUSES, ORDER_TRIP_STATUSES
}) => {
  const [expandedTripOrder, setExpandedTripOrder] = React.useState(null);
  
  // Count orders with amocrm_id
  const ordersWithAmoCRM = selectedTrip?.orderIds?.filter(orderId => {
    const order = sectionData[selectedTrip.section]?.orders.find(o => o.id === orderId);
    return order?.amocrm_id;
  }).length || 0;
  
  return (
  <Card className="h-full">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">{selectedTrip ? selectedTrip.name : 'Выберите рейс'}</CardTitle>
    </CardHeader>
    <CardContent className="p-3">
      {selectedTrip && selectedTrip.section === sectionKey ? (
        <div className="space-y-3">
          {/* Driver */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Водитель:</Label>
            <Select value={selectedTrip.driverId || 'none'} onValueChange={(value) => {
              const driver = drivers.find(d => d.id === value);
              updateTrip(selectedTrip.id, { driverId: value === 'none' ? null : value, driverName: driver?.name || null });
            }}>
              <SelectTrigger className="h-8 text-sm" data-testid="trip-driver-select"><SelectValue placeholder="Выберите водителя" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          {/* Departure Date */}
          <div className="space-y-1">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Дата отправки:
            </Label>
            <Input
              type="date"
              value={selectedTrip.departureDate || ''}
              onChange={(e) => {
                updateTrip(selectedTrip.id, { departureDate: e.target.value });
              }}
              className="h-8 text-sm"
              data-testid="trip-departure-date"
            />
          </div>
          
          {/* Status with sync checkbox */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Статус рейса:</Label>
            <Select value={selectedTrip.status || 'planned'} onValueChange={(value) => {
              // Use updateTripStatus which syncs all order statuses
              updateTripStatus(selectedTrip.id, value);
            }}>
              <SelectTrigger className="h-8 text-sm" data-testid="trip-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TRIP_STATUSES).map(([key, val]) => {
                  const StatusIcon = val.icon;
                  return <SelectItem key={key} value={key}><div className="flex items-center gap-2"><StatusIcon className="h-3 w-3" />{val.label}</div></SelectItem>;
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              При изменении статуса рейса обновятся статусы всех заказов
            </p>
          </div>
          
          {tripRouteInfo && (
            <div className="flex gap-3 p-2 bg-purple-50 rounded-lg text-sm">
              <div className="flex items-center gap-1"><Navigation className="h-3 w-3 text-purple-600" /><span className="font-medium">{formatDistance(tripRouteInfo.distance)}</span></div>
              <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-purple-600" /><span className="font-medium">{formatDuration(tripRouteInfo.duration)}</span></div>
            </div>
          )}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">Заказы ({selectedTrip.orderIds?.length || 0}):</p>
              {selectedTrip.orderIds?.length >= 1 && (
                <Button size="sm" variant="outline" onClick={optimizeTripRoute} disabled={optimizingRoute} className="gap-1 h-7 text-xs" data-testid="optimize-route-btn">
                  {optimizingRoute ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Оптимизировать
                </Button>
              )}
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {selectedTrip.orderIds?.map((orderId, index) => {
                const order = sectionData[selectedTrip.section]?.orders.find(o => o.id === orderId);
                const orderStatus = selectedTrip.orderStatuses?.[orderId] || 'pending';
                const statusInfo = ORDER_TRIP_STATUSES[orderStatus] || ORDER_TRIP_STATUSES.pending;
                const isExpanded = expandedTripOrder === orderId;
                
                return order ? (
                  <div key={orderId} className={`p-2 rounded transition-all text-xs ${draggedOrderIndex === index ? 'opacity-50 scale-95' : ''} ${order.isImportant ? 'bg-orange-100 border border-orange-300' : 'bg-muted'}`} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={(e) => handleDrop(e, index)} onDragEnd={handleDragEnd}>
                    <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-bold w-5 text-center text-purple-600">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{order.fullName || order.customerName}</p>
                          {order.isImportant && <span className="text-orange-600 font-bold text-[10px]">⚠️</span>}
                          {order.amocrm_link && <a href={order.amocrm_link} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-700" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3 w-3" /></a>}
                        </div>
                        <p className="text-muted-foreground truncate">{order.fullAddress || order.address}</p>
                      </div>
                      {order.lat && order.lng ? <span className="px-1 rounded bg-green-100 text-green-700 flex-shrink-0">✓</span> : <span className="px-1 rounded bg-gray-100 text-gray-500 flex-shrink-0">?</span>}
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setExpandedTripOrder(isExpanded ? null : orderId)}>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                      <div className="flex flex-col flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={() => moveOrderUp(index)} disabled={index === 0}><ArrowUp className="h-2.5 w-2.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={() => moveOrderDown(index)} disabled={index === selectedTrip.orderIds.length - 1}><ArrowDown className="h-2.5 w-2.5" /></Button>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeOrderFromTrip(selectedTrip.id, orderId)} className="text-red-500 h-5 w-5 p-0 flex-shrink-0"><X className="h-3 w-3" /></Button>
                    </div>
                    
                    {/* Status row - always visible */}
                    <div className="flex items-center gap-2 mt-2 pl-6">
                      <span className="text-muted-foreground">Статус:</span>
                      <Select value={orderStatus} onValueChange={(value) => updateOrderStatusInTrip(selectedTrip.id, orderId, value)}>
                        <SelectTrigger className={`h-6 text-xs w-auto min-w-[120px] ${statusInfo.color}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ORDER_TRIP_STATUSES).map(([key, info]) => <SelectItem key={key} value={key}><span className={`px-2 py-0.5 rounded ${info.color}`}>{info.label}</span></SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 pl-6">
                        {order.phoneNumber && (
                          <p className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <a href={`tel:${order.phoneNumber}`} className="text-blue-600 hover:underline">{order.phoneNumber}</a>
                          </p>
                        )}
                        
                        {/* Trip data being sent to amoCRM */}
                        {order.amocrm_id && (
                          <div className="bg-green-50 rounded p-2 space-y-1 border border-green-100">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                Данные для синхронизации с amoCRM
                              </span>
                              <span className="text-xs text-green-600">ID: {order.amocrm_id}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Рейс:</span>
                                <span className="font-medium">{order.tripName || selectedTrip?.name || '-'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Водитель:</span>
                                <span className="font-medium">{order.tripDriverName || selectedTrip?.driverName || '-'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Дата отправки:</span>
                                <span className="font-medium">{order.tripDepartureDate || selectedTrip?.departureDate || '-'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Статус:</span>
                                <span className={`font-medium px-1.5 py-0.5 rounded ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {order.amocrm_id && (
                          <div className="bg-purple-50 rounded p-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-purple-700">Данные из amoCRM</span>
                              {order.amocrm_link && (
                                <a href={order.amocrm_link} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  Открыть
                                </a>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {order.orderNumber && <div><span className="text-muted-foreground">№:</span> {order.orderNumber}</div>}
                              {order.dealSum && <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-600" />{order.dealSum}</div>}
                              {order.debtSum && <div className="text-red-600">Долг: {order.debtSum}</div>}
                            </div>
                            {order.orderContents && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Состав:</span>
                                <p className="mt-1 p-1.5 bg-white rounded border text-xs whitespace-pre-wrap max-h-[100px] overflow-y-auto">{order.orderContents}</p>
                              </div>
                            )}
                            {order.orderComment && (
                              <div className="text-xs">
                                <span className="text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />Комментарий:</span>
                                <p className="mt-1 p-1.5 bg-white rounded border text-xs">{order.orderComment}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {order.notes && !order.amocrm_id && (
                          <p className="flex items-start gap-2 text-xs">
                            <FileText className="h-3 w-3 mt-0.5 text-muted-foreground" />
                            <span className="break-words">{order.notes}</span>
                          </p>
                        )}
                        
                        {order.orderComposition && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Состав заказа:</span>
                            <p className="mt-1 p-1.5 bg-white rounded border whitespace-pre-wrap max-h-[100px] overflow-y-auto">{order.orderComposition}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : <div key={orderId} className="p-1.5 bg-muted rounded text-xs text-muted-foreground">Заказ {orderId} не найден</div>;
              })}
              {(!selectedTrip.orderIds || selectedTrip.orderIds.length === 0) && <p className="text-center text-muted-foreground py-3 text-xs">Нет заказов</p>}
            </div>
          </div>
          
          {/* Sync to amoCRM button */}
          {ordersWithAmoCRM > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-purple-600 border-purple-200 hover:bg-purple-50 mt-2"
                onClick={() => syncTripToAmocrm(selectedTrip.id)}
                disabled={syncingToAmocrm}
                data-testid="sync-amocrm-btn"
              >
                {syncingToAmocrm ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Синхронизировать с amoCRM ({ordersWithAmoCRM})
              </Button>
              {selectedTrip.lastSyncedAt && (
                <p className="text-xs text-center text-muted-foreground mt-1">
                  Последняя синхронизация: {new Date(selectedTrip.lastSyncedAt).toLocaleString('ru-RU')}
                </p>
              )}
            </>
          )}
          
          {/* Print orders list button */}
          {selectedTrip.orderIds?.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 mt-2"
              onClick={() => printTripOrders(selectedTrip, sectionData)}
              data-testid="print-orders-btn"
            >
              <Printer className="h-3 w-3 mr-1" />
              Распечатать список ({selectedTrip.orderIds.length})
            </Button>
          )}
          
          <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50 mt-2" onClick={() => deleteTrip(selectedTrip.id)}>
            <Trash2 className="h-3 w-3 mr-1" />Удалить рейс
          </Button>
        </div>
      ) : <p className="text-center text-muted-foreground py-8 text-sm">Выберите рейс слева</p>}
    </CardContent>
  </Card>
);
};

const TripMapCard = ({ selectedTrip, sectionData, isLoaded, warehouseCoords, warehouseAddress, tripDirections, buildingTripRoute, tripMapRef }) => (
  <Card className="h-full">
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <MapPin className="h-4 w-4" />Карта маршрута
        {buildingTripRoute && <RefreshCw className="h-3 w-3 animate-spin ml-2" />}
      </CardTitle>
      {!warehouseCoords && <p className="text-xs text-orange-600 flex items-center gap-1 mt-1"><Warehouse className="h-3 w-3" />Укажите адрес склада в настройках для построения полного маршрута</p>}
    </CardHeader>
    <CardContent className="p-3">
      {!isLoaded ? (
        <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '400px', borderRadius: '8px' }}
          center={defaultCenter}
          zoom={6}
          onLoad={(map) => { tripMapRef.current = map; }}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
        >
          {warehouseCoords && warehouseCoords.lat && warehouseCoords.lng && (
            <Marker
              key="warehouse-trip"
              position={{ lat: warehouseCoords.lat, lng: warehouseCoords.lng }}
              title={`Склад: ${warehouseAddress}`}
              icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#f97316', fillOpacity: 1, strokeColor: 'white', strokeWeight: 3 }}
              label={{ text: 'С', color: 'white', fontWeight: 'bold', fontSize: '12px' }}
            />
          )}
          {selectedTrip && selectedTrip.orderIds?.map((orderId, index) => {
            const order = sectionData[selectedTrip.section]?.orders.find(o => o.id === orderId);
            if (!order || !order.lat || !order.lng) return null;
            return (
              <Marker
                key={`trip-order-${orderId}`}
                position={{ lat: order.lat, lng: order.lng }}
                title={`${index + 1}. ${order.fullName || order.customerName}\n${order.fullAddress || order.address}`}
                label={{ text: String(index + 1), color: 'white', fontWeight: 'bold', fontSize: '11px' }}
                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#9333ea', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 }}
              />
            );
          })}
          {tripDirections && (
            <DirectionsRenderer directions={tripDirections} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#9333ea', strokeWeight: 4, strokeOpacity: 0.8 } }} />
          )}
        </GoogleMap>
      )}
    </CardContent>
  </Card>
);

const CreateTripModal = ({ currentSection, currentData, drivers, newTripName, setNewTripName, newTripDriver, setNewTripDriver, creatingTrip, createTrip, setShowCreateTripModal }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Route className="h-5 w-5 text-purple-600" />Создать рейс — {currentSection.name.ru}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Название рейса *</Label>
          <Input value={newTripName} onChange={(e) => setNewTripName(e.target.value)} placeholder="Например: Рейс 15 января" data-testid="trip-name-input" />
        </div>
        <div className="space-y-2">
          <Label>Водитель</Label>
          <Select value={newTripDriver} onValueChange={setNewTripDriver}>
            <SelectTrigger data-testid="trip-driver-input"><SelectValue placeholder="Выберите водителя (опционально)" /></SelectTrigger>
            <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-1">Выбранные заказы: {currentData.selectedOrders.length}</p>
          <div className="max-h-[150px] overflow-y-auto space-y-1">
            {currentData.selectedOrders.map(orderId => {
              const order = currentData.orders.find(o => o.id === orderId);
              return order ? <p key={orderId} className="text-xs text-muted-foreground truncate">• {order.fullName || order.customerName} — {order.fullAddress || order.address || 'без адреса'}</p> : null;
            })}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => { setShowCreateTripModal(false); setNewTripName(''); setNewTripDriver(''); }}>Отмена</Button>
          <Button onClick={createTrip} disabled={creatingTrip || !newTripName.trim()} className="bg-purple-600 hover:bg-purple-700" data-testid="create-trip-submit">
            {creatingTrip ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Создать рейс
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

const AddToTripModal = ({ currentSection, currentData, trips, activeSection, drivers, addToTripId, setAddToTripId, addingToTrip, addOrdersToTrip, setShowAddToTripModal, TRIP_STATUSES }) => {
  // Filter trips: only from current section, only planned or in_transit status
  const availableTrips = trips.filter(t => 
    t.section === activeSection && 
    (t.status === 'planned' || t.status === 'in_transit')
  );
  
  const selectedTrip = availableTrips.find(t => t.id === addToTripId);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Добавить в рейс — {currentSection.name.ru}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trip selection */}
          <div className="space-y-2">
            <Label>Выберите рейс *</Label>
            {availableTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                Нет активных рейсов для добавления. Создайте новый рейс.
              </p>
            ) : (
              <Select value={addToTripId} onValueChange={setAddToTripId}>
                <SelectTrigger data-testid="add-to-trip-select">
                  <SelectValue placeholder="Выберите рейс" />
                </SelectTrigger>
                <SelectContent>
                  {availableTrips.map(trip => (
                    <SelectItem key={trip.id} value={trip.id}>
                      <div className="flex items-center gap-2">
                        <span>{trip.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {TRIP_STATUSES[trip.status]?.label || trip.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({trip.orderIds?.length || 0} заказов)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Selected trip info */}
          {selectedTrip && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-blue-900">{selectedTrip.name}</span>
                <Badge className={TRIP_STATUSES[selectedTrip.status]?.color || 'bg-gray-100'}>
                  {TRIP_STATUSES[selectedTrip.status]?.label || selectedTrip.status}
                </Badge>
              </div>
              {selectedTrip.driverName && (
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <User className="h-3 w-3" />
                  <span>Водитель: {selectedTrip.driverName}</span>
                </div>
              )}
              {selectedTrip.departureDate && (
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Calendar className="h-3 w-3" />
                  <span>Отправка: {selectedTrip.departureDate}</span>
                </div>
              )}
              <p className="text-xs text-blue-600">
                Уже в рейсе: {selectedTrip.orderIds?.length || 0} заказов
              </p>
            </div>
          )}
          
          {/* Selected orders */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Добавляемые заказы: {currentData.selectedOrders.length}</p>
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
          
          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => { setShowAddToTripModal(false); setAddToTripId(''); }}>
              Отмена
            </Button>
            <Button 
              onClick={() => addOrdersToTrip(addToTripId)} 
              disabled={addingToTrip || !addToTripId || availableTrips.length === 0} 
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="add-to-trip-submit"
            >
              {addingToTrip ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Добавить в рейс
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
