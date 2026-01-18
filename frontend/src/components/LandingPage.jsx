import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Waves, Flame, ArrowRight, Lock, Shield, Truck, User, Package, Kanban, GraduationCap } from 'lucide-react';

export const LandingPage = ({ onSelectCalculator, hasAccess }) => {
  const { i18n } = useTranslation();
  const { isAdmin, user } = useAuth();
  
  // Debug: log user role
  console.log('LandingPage - user:', user, 'role:', user?.role);

  const texts = {
    ru: {
      title: 'Выберите сервис',
      subtitle: 'Выберите нужный раздел для работы',
      baliaTitle: 'Купель (Balia)',
      baliaDesc: 'Калькулятор для конфигурации и расчёта стоимости купелей с джакузи',
      saunaTitle: 'Сауна (Sauna)',
      saunaDesc: 'Калькулятор для конфигурации и расчёта стоимости саун',
      logisticsTitle: 'Логистика',
      logisticsDesc: 'Планирование маршрутов доставки и управление заказами на карте',
      driverTitle: 'Кабинет водителя',
      driverDesc: 'Просмотр назначенных рейсов, навигация и подтверждение доставок',
      warehouseTitle: 'Склад',
      warehouseDesc: 'Комплектация заказов и подготовка к отправке',
      saunaCrmTitle: 'CRM Сауны',
      saunaCrmDesc: 'Управление заявками на сауны с Kanban-доской и интеграцией с amoCRM',
      trainingTitle: 'Обучение',
      trainingDesc: 'Обучающие курсы и видео-уроки для менеджеров',
      adminTitle: 'Админ панель',
      adminDesc: 'Управление всеми заказами, статистика и настройки цен',
      select: 'Выбрать',
      comingSoon: 'Скоро',
      noAccess: 'Нет доступа',
    },
    pl: {
      title: 'Wybierz serwis',
      subtitle: 'Wybierz odpowiednią sekcję do pracy',
      baliaTitle: 'Balia',
      baliaDesc: 'Kalkulator do konfiguracji i wyceny bali z jacuzzi',
      saunaTitle: 'Sauna',
      saunaDesc: 'Kalkulator do konfiguracji i wyceny saun',
      logisticsTitle: 'Logistyka',
      logisticsDesc: 'Planowanie tras dostaw i zarządzanie zamówieniami na mapie',
      driverTitle: 'Panel kierowcy',
      driverDesc: 'Podgląd przydzielonych tras, nawigacja i potwierdzanie dostaw',
      warehouseTitle: 'Magazyn',
      warehouseDesc: 'Kompletacja zamówień i przygotowanie do wysyłki',
      saunaCrmTitle: 'CRM Sauny',
      saunaCrmDesc: 'Zarządzanie leadami saun z tablicą Kanban i integracją amoCRM',
      trainingTitle: 'Szkolenia',
      trainingDesc: 'Kursy szkoleniowe i lekcje wideo dla menedżerów',
      adminTitle: 'Panel administracyjny',
      adminDesc: 'Zarządzanie wszystkimi zamówieniami, statystyki i ustawienia cen',
      select: 'Wybierz',
      comingSoon: 'Wkrótce',
      noAccess: 'Brak dostępu',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  const canAccessBalia = hasAccess ? hasAccess('balia') : true;
  const canAccessSauna = hasAccess ? hasAccess('sauna') : true;
  const canAccessLogistics = hasAccess ? hasAccess('logistics') : false;
  const canAccessDriver = hasAccess ? hasAccess('driver') : false;
  const canAccessWarehouse = hasAccess ? hasAccess('warehouse') : false;
  const canAccessSaunaCRM = hasAccess ? hasAccess('sauna_crm') : false;
  // Training is available for all logged-in users except drivers and warehouse
  const canAccessTraining = user && user.role !== 'driver' && user.role !== 'warehouse';
  const canAccessAdmin = isAdmin && isAdmin();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {txt.title}
          </h1>
          <p className="text-muted-foreground text-lg">
            {txt.subtitle}
          </p>
        </div>

        {/* First Row: Balia, Sauna, Admin */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Balia Card */}
          <Card 
            className={`group transition-all duration-300 border-2 ${
              canAccessBalia 
                ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-primary/50' 
                : 'opacity-60 cursor-not-allowed'
            }`}
            onClick={() => canAccessBalia && onSelectCalculator('balia')}
          >
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${
                  canAccessBalia 
                    ? 'bg-primary/10 group-hover:bg-primary/20' 
                    : 'bg-muted'
                }`}>
                  {canAccessBalia ? (
                    <Waves className="w-10 h-10 text-primary" />
                  ) : (
                    <Lock className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  {txt.baliaTitle}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {txt.baliaDesc}
                </p>
                {canAccessBalia ? (
                  <Button className="w-full gap-2 group-hover:gap-3 transition-all">
                    {txt.select}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button disabled className="w-full gap-2" variant="secondary">
                    <Lock className="w-4 h-4" />
                    {txt.noAccess}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sauna Card */}
          <Card 
            className={`group transition-all duration-300 border-2 ${
              canAccessSauna 
                ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-orange-500/50' 
                : 'opacity-60 cursor-not-allowed'
            }`}
            onClick={() => canAccessSauna && onSelectCalculator('sauna')}
          >
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${
                  canAccessSauna 
                    ? 'bg-orange-500/10 group-hover:bg-orange-500/20' 
                    : 'bg-muted'
                }`}>
                  {canAccessSauna ? (
                    <Flame className="w-10 h-10 text-orange-500" />
                  ) : (
                    <Lock className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  {txt.saunaTitle}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {txt.saunaDesc}
                </p>
                {canAccessSauna ? (
                  <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-orange-500/50 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600">
                    {txt.select}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button disabled className="w-full gap-2" variant="secondary">
                    <Lock className="w-4 h-4" />
                    {txt.noAccess}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Admin Panel Card - Only visible for admins */}
          {canAccessAdmin && (
            <Card 
              className="group transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-violet-500/50"
              onClick={() => onSelectCalculator('admin')}
            >
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors bg-violet-500/10 group-hover:bg-violet-500/20">
                    <Shield className="w-10 h-10 text-violet-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3">
                    {txt.adminTitle}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {txt.adminDesc}
                  </p>
                  <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-violet-500/50 text-violet-600 hover:bg-violet-500/10 hover:text-violet-600">
                    {txt.select}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Second Row: Logistics, Driver, Warehouse, Sauna CRM */}
        {(canAccessLogistics || canAccessDriver || canAccessWarehouse || canAccessSaunaCRM) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Logistics Card */}
            {canAccessLogistics && (
              <Card 
                className="group transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-teal-500/50"
                onClick={() => onSelectCalculator('logistics')}
              >
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors bg-teal-500/10 group-hover:bg-teal-500/20">
                      <Truck className="w-10 h-10 text-teal-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-3">
                      {txt.logisticsTitle}
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {txt.logisticsDesc}
                    </p>
                    <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-teal-500/50 text-teal-600 hover:bg-teal-500/10 hover:text-teal-600">
                      {txt.select}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warehouse Card */}
            {canAccessWarehouse && (
              <Card 
                className="group transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-amber-500/50"
                onClick={() => onSelectCalculator('warehouse')}
                data-testid="warehouse-card"
              >
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors bg-amber-500/10 group-hover:bg-amber-500/20">
                      <Package className="w-10 h-10 text-amber-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-3">
                      {txt.warehouseTitle}
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {txt.warehouseDesc}
                    </p>
                    <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600">
                      {txt.select}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Training Card */}
            {canAccessTraining && (
              <Card 
                className="group transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-emerald-500/50"
                onClick={() => onSelectCalculator('training')}
                data-testid="training-card"
              >
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors bg-emerald-500/10 group-hover:bg-emerald-500/20">
                      <GraduationCap className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-3">
                      {txt.trainingTitle}
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {txt.trainingDesc}
                    </p>
                    <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600">
                      {txt.select}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Driver Panel Card */}
            {canAccessDriver && (
              <Card 
                className="group transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-green-500/50"
                onClick={() => onSelectCalculator('driver')}
                data-testid="driver-panel-card"
              >
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors bg-green-500/10 group-hover:bg-green-500/20">
                      <User className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-3">
                      {txt.driverTitle}
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {txt.driverDesc}
                    </p>
                    <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-600">
                      {txt.select}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sauna CRM Card - TEMPORARILY HIDDEN */}
            {false && canAccessSaunaCRM && (
              <Card 
                className="group transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-rose-500/50"
                onClick={() => onSelectCalculator('sauna_crm')}
                data-testid="sauna-crm-card"
              >
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors bg-rose-500/10 group-hover:bg-rose-500/20">
                      <Kanban className="w-10 h-10 text-rose-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-3">
                      {txt.saunaCrmTitle}
                    </h2>
                    <p className="text-muted-foreground mb-3">
                      {txt.saunaCrmDesc}
                    </p>
                    <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-rose-500/50 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600">
                      {txt.select}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
