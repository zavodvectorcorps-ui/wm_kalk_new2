import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ClipboardList, BarChart3, DollarSign, Users, Waves, Flame, ArrowLeft, FileText } from 'lucide-react';
import { AdminOrdersPage } from './AdminOrdersPage';
import { StatisticsPage } from './StatisticsPage';
import { BaliaPricingPage } from './BaliaPricingPage';
import { SaunaPricingPage } from './SaunaPricingPage';
import { UserManagement } from './UserManagement';
import { TechSpecAdminPage } from './TechSpecAdminPage';

export const AdminPanel = ({ onBackToLanding, onEditInCalculator }) => {
  const { i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [statsType, setStatsType] = useState('balia');
  const [pricesType, setPricesType] = useState('balia');

  const texts = {
    ru: {
      backToSelection: 'Назад к выбору',
      orders: 'Заказы',
      statistics: 'Статистика',
      prices: 'Цены',
      employees: 'Сотрудники',
      selectProject: 'Выберите проект:',
      balia: 'Купели',
      sauna: 'Сауны',
    },
    pl: {
      backToSelection: 'Powrót do wyboru',
      orders: 'Zamówienia',
      statistics: 'Statystyki',
      prices: 'Ceny',
      employees: 'Pracownicy',
      selectProject: 'Wybierz projekt:',
      balia: 'Balie',
      sauna: 'Sauny',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Type selector component
  const TypeSelector = ({ value, onChange }) => (
    <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
      <span className="text-sm text-muted-foreground">{txt.selectProject}</span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={value === 'balia' ? 'default' : 'outline'}
          onClick={() => onChange('balia')}
          className="gap-2"
        >
          <Waves className="w-4 h-4" />
          {txt.balia}
        </Button>
        <Button
          size="sm"
          variant={value === 'sauna' ? 'default' : 'outline'}
          onClick={() => onChange('sauna')}
          className={`gap-2 ${value === 'sauna' ? 'bg-orange-500 hover:bg-orange-600' : 'border-orange-500/50 text-orange-600 hover:bg-orange-500/10'}`}
        >
          <Flame className="w-4 h-4" />
          {txt.sauna}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Back Button */}
      <div className="container mx-auto px-4 pt-4 max-w-7xl">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBackToLanding}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {txt.backToSelection}
        </Button>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="orders" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">{txt.orders}</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{txt.statistics}</span>
            </TabsTrigger>
            <TabsTrigger value="prices" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">{txt.prices}</span>
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{txt.employees}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <AdminOrdersPage onEditInCalculator={onEditInCalculator} />
          </TabsContent>

          <TabsContent value="statistics">
            <TypeSelector value={statsType} onChange={setStatsType} />
            <StatisticsPage calculatorType={statsType} />
          </TabsContent>

          <TabsContent value="prices">
            <TypeSelector value={pricesType} onChange={setPricesType} />
            {pricesType === 'balia' ? (
              <BaliaPricingPage />
            ) : (
              <SaunaPricingPage />
            )}
          </TabsContent>

          <TabsContent value="employees">
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
