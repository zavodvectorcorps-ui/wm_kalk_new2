import React, { useState } from 'react';
import './i18n/config';
import { Header } from './components/Header';
import { CalculatorPage } from './components/CalculatorPage';
import { OrdersPage } from './components/OrdersPage';
import { PricingPage } from './components/PricingPage';
import { Toaster } from './components/ui/sonner';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('calculator');
  const [pricesUpdated, setPricesUpdated] = useState(0);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Force CalculatorPage to reload prices when switching to it
    if (tab === 'calculator') {
      setPricesUpdated(prev => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header activeTab={activeTab} onTabChange={handleTabChange} />
      
      <main>
        {activeTab === 'calculator' && <CalculatorPage key={pricesUpdated} />}
        {activeTab === 'orders' && <OrdersPage />}
        {activeTab === 'pricing' && <PricingPage />}
      </main>
      
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
