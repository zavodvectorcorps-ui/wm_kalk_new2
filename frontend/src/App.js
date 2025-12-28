import React, { useState, useEffect } from 'react';
import './i18n/config';
import { LandingPage } from './components/LandingPage';
import { LandingHeader } from './components/LandingHeader';
import { Header } from './components/Header';
import { CalculatorPage } from './components/CalculatorPage';
import { OrdersPage } from './components/OrdersPage';
import { PricingPage } from './components/PricingPage';
import { AdminLogin } from './components/AdminLogin';
import { SaunaPlaceholder } from './components/SaunaPlaceholder';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './App.css';

function App() {
  const { i18n } = useTranslation();
  const [currentCalculator, setCurrentCalculator] = useState(null); // null = landing, 'balia', 'sauna'
  const [activeTab, setActiveTab] = useState('calculator');
  const [pricesUpdated, setPricesUpdated] = useState(0);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Check admin auth on mount
  useEffect(() => {
    const authStatus = sessionStorage.getItem('adminAuth') === 'true';
    setIsAdminAuthenticated(authStatus);
  }, []);

  const handleSelectCalculator = (calculator) => {
    setCurrentCalculator(calculator);
    setActiveTab('calculator');
  };

  const handleBackToLanding = () => {
    setCurrentCalculator(null);
    setActiveTab('calculator');
  };

  const handleTabChange = (tab) => {
    if (tab === 'pricing' && !isAdminAuthenticated) {
      setIsAdminLoginOpen(true);
      return;
    }
    
    setActiveTab(tab);
    if (tab === 'calculator') {
      setPricesUpdated(prev => prev + 1);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setIsAdminLoginOpen(false);
    setActiveTab('pricing');
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAdminAuthenticated(false);
    setActiveTab('calculator');
  };

  const backButtonText = i18n.language === 'pl' ? 'Powrót do wyboru' : 'Назад к выбору';

  // Landing Page
  if (!currentCalculator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <LandingHeader />
        <LandingPage onSelectCalculator={handleSelectCalculator} />
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
          isAdminAuthenticated={isAdminAuthenticated}
          onAdminLogout={handleAdminLogout}
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
            {backButtonText}
          </Button>
        </div>
        
        <main>
          {activeTab === 'calculator' && <CalculatorPage key={pricesUpdated} />}
          {activeTab === 'orders' && <OrdersPage />}
          {activeTab === 'pricing' && isAdminAuthenticated && <PricingPage />}
        </main>
        
        <AdminLogin 
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onSuccess={handleAdminLoginSuccess}
        />
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Sauna Calculator (placeholder for now)
  if (currentCalculator === 'sauna') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <LandingHeader />
        
        {/* Back Button */}
        <div className="container mx-auto px-4 pt-4 max-w-7xl">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackToLanding}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {backButtonText}
          </Button>
        </div>
        
        <SaunaPlaceholder />
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  return null;
}

export default App;
