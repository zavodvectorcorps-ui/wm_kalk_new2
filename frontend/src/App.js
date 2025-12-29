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
import { UserManagement } from './components/UserManagement';
import { SaunaCalculator } from './components/SaunaCalculator';
import { SaunaPricingPage } from './components/SaunaPricingPage';
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
    // Check access
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
    }
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
          {activeTab === 'calculator' && <CalculatorPage key={pricesUpdated} />}
          {activeTab === 'orders' && <OrdersPage />}
          {activeTab === 'pricing' && canViewPricing() && <PricingPage />}
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
          <OrdersPage calculatorType="sauna" />
        ) : activeTab === 'pricing' && canViewPricing() ? (
          <SaunaPricingPage />
        ) : (
          <SaunaCalculator />
        )}
        
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
