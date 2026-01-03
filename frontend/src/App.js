import React, { useState, useEffect } from 'react';
import './i18n/config';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { LandingHeader } from './components/LandingHeader';
import { Header } from './components/Header';
import { CalculatorPage } from './components/CalculatorPage';
import { OrdersPage } from './components/OrdersPage';
import { PricingPage } from './components/PricingPage';
import { BaliaPricingPage } from './components/BaliaPricingPage';
import { UserManagement } from './components/UserManagement';
import { SaunaCalculator } from './components/SaunaCalculator';
import { SaunaPricingPage } from './components/SaunaPricingPage';
import { TechSpecAdminPage } from './components/TechSpecAdminPage';
import { StatisticsPage } from './components/StatisticsPage';
import { AdminPanel } from './components/AdminPanel';
import { WebOrdersPage } from './components/WebOrdersPage';
import { EmbedBaliaCalculator } from './components/EmbedBaliaCalculator';
import { EmbedCodePage } from './components/EmbedCodePage';
import { BackupPage } from './components/BackupPage';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './App.css';

const AppContent = () => {
  const { i18n } = useTranslation();
  const { user, loading, isAdmin, hasAccess, logout, canViewPricing } = useAuth();
  const [currentCalculator, setCurrentCalculator] = useState(null);
  const [activeTab, setActiveTab] = useState('calculator');
  const [pricesUpdated, setPricesUpdated] = useState(0);
  const [editingOrder, setEditingOrder] = useState(null); // Order being edited in calculator

  const texts = {
    ru: {
      backToSelection: 'Назад к выбору',
      noAccess: 'У вас нет доступа к этому калькулятору',
      backToHome: 'Вернуться на главную',
    },
    pl: {
      backToSelection: 'Powrót do wyboru',
      noAccess: 'Nie masz dostępu do tego kalkulatora',
      backToHome: 'Powrót do strony głównej',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Check for embed URL - show public calculator without auth
  const isEmbed = window.location.pathname.startsWith('/embed');
  if (isEmbed) {
    return (
      <>
        <EmbedBaliaCalculator />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Not logged in - show login page
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <LandingHeader />
        <LoginPage />
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  const handleSelectCalculator = (calculator) => {
    // Admin panel - check if user is admin
    if (calculator === 'admin') {
      if (isAdmin && isAdmin()) {
        setCurrentCalculator('admin');
        setActiveTab('orders');
        return;
      }
      return; // Don't navigate if not admin
    }
    
    // Check access for calculators
    if (!hasAccess(calculator)) {
      return; // Don't navigate if no access
    }
    setCurrentCalculator(calculator);
    setActiveTab('calculator');
  };

  const handleBackToLanding = () => {
    setCurrentCalculator(null);
    setActiveTab('calculator');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'calculator') {
      setPricesUpdated(prev => prev + 1);
      setEditingOrder(null); // Clear editing mode when switching to calculator tab
    }
  };

  // Handle editing order in calculator
  const handleEditOrderInCalculator = (order, calculatorType) => {
    setCurrentCalculator(calculatorType);
    setEditingOrder(order);
    setActiveTab('calculator');
  };

  const handleLogout = () => {
    logout();
    setCurrentCalculator(null);
    setActiveTab('calculator');
  };

  // Landing Page - show calculator selection
  if (!currentCalculator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isAdminAuthenticated={isAdmin()}
          onAdminLogout={handleLogout}
          showNavigation={false}
          showUsers={isAdmin()}
        />
        
        {activeTab === 'users' && isAdmin() ? (
          <>
            {/* Back Button */}
            <div className="container mx-auto px-4 pt-4 max-w-7xl">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setActiveTab('calculator')}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                {txt.backToSelection}
              </Button>
            </div>
            <UserManagement />
          </>
        ) : (
          <LandingPage onSelectCalculator={handleSelectCalculator} hasAccess={hasAccess} />
        )}
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Access denied page
  if (!hasAccess(currentCalculator)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <LandingHeader />
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">{txt.noAccess}</h2>
            <Button onClick={handleBackToLanding}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {txt.backToHome}
            </Button>
          </div>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Balia Calculator
  if (currentCalculator === 'balia') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isAdminAuthenticated={isAdmin()}
          onAdminLogout={handleLogout}
          showNavigation={true}
          showUsers={isAdmin()}
          calculatorType="balia"
        />
        
        {/* Back Button */}
        <div className="container mx-auto px-4 pt-4 max-w-7xl">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackToLanding}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {txt.backToSelection}
          </Button>
        </div>
        
        <main>
          {activeTab === 'calculator' && <CalculatorPage key={pricesUpdated} editingOrder={editingOrder} onEditComplete={() => setEditingOrder(null)} />}
          {activeTab === 'orders' && <OrdersPage onEditInCalculator={(order) => handleEditOrderInCalculator(order, 'balia')} />}
          {activeTab === 'weborders' && <WebOrdersPage />}
          {activeTab === 'statistics' && <StatisticsPage calculatorType="balia" />}
          {activeTab === 'pricing' && canViewPricing() && <BaliaPricingPage />}
          {activeTab === 'embed' && isAdmin() && <EmbedCodePage />}
          {activeTab === 'users' && isAdmin() && <UserManagement />}
        </main>
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Sauna Calculator
  if (currentCalculator === 'sauna') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isAdminAuthenticated={isAdmin()}
          onAdminLogout={handleLogout}
          showNavigation={true}
          showUsers={isAdmin()}
          calculatorType="sauna"
        />
        
        {/* Back Button */}
        <div className="container mx-auto px-4 pt-4 max-w-7xl">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackToLanding}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {txt.backToSelection}
          </Button>
        </div>
        
        {activeTab === 'users' && isAdmin() ? (
          <UserManagement />
        ) : activeTab === 'orders' ? (
          <OrdersPage calculatorType="sauna" onEditInCalculator={(order) => handleEditOrderInCalculator(order, 'sauna')} />
        ) : activeTab === 'statistics' ? (
          <StatisticsPage calculatorType="sauna" />
        ) : activeTab === 'pricing' && canViewPricing() ? (
          <SaunaPricingPage />
        ) : activeTab === 'techspec' && canViewPricing() ? (
          <TechSpecAdminPage />
        ) : activeTab === 'backup' && isAdmin() ? (
          <BackupPage />
        ) : (
          <SaunaCalculator editingOrder={editingOrder} onEditComplete={() => setEditingOrder(null)} />
        )}
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Admin Panel
  if (currentCalculator === 'admin' && isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isAdminAuthenticated={isAdmin()}
          onAdminLogout={handleLogout}
          showNavigation={false}
          showUsers={false}
          calculatorType="admin"
        />
        
        <AdminPanel 
          onBackToLanding={handleBackToLanding}
          onEditInCalculator={handleEditOrderInCalculator}
        />
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  return null;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
