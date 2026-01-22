import React, { useState, useEffect, lazy, Suspense } from 'react';
import './i18n/config';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { LandingHeader } from './components/LandingHeader';
import { Header } from './components/Header';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './App.css';

// Lazy load heavy components for faster initial load
const CalculatorPage = lazy(() => import('./components/CalculatorPage').then(m => ({ default: m.CalculatorPage })));
const OrdersPage = lazy(() => import('./components/OrdersPage').then(m => ({ default: m.OrdersPage })));
const BaliaPricingPage = lazy(() => import('./components/BaliaPricingPage').then(m => ({ default: m.BaliaPricingPage })));
const UserManagement = lazy(() => import('./components/UserManagement').then(m => ({ default: m.UserManagement })));
const SaunaCalculator = lazy(() => import('./components/SaunaCalculator').then(m => ({ default: m.SaunaCalculator })));
const SaunaPricingPage = lazy(() => import('./components/SaunaPricingPage').then(m => ({ default: m.SaunaPricingPage })));
const TechSpecAdminPage = lazy(() => import('./components/TechSpecAdminPage').then(m => ({ default: m.TechSpecAdminPage })));
const StatisticsPage = lazy(() => import('./components/StatisticsPage').then(m => ({ default: m.StatisticsPage })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const WebOrdersPage = lazy(() => import('./components/WebOrdersPage').then(m => ({ default: m.WebOrdersPage })));
const EmbedBaliaCalculator = lazy(() => import('./components/EmbedBaliaCalculator').then(m => ({ default: m.EmbedBaliaCalculator })));
const EmbedCodePage = lazy(() => import('./components/EmbedCodePage').then(m => ({ default: m.EmbedCodePage })));
const LogisticsPage = lazy(() => import('./components/LogisticsPage').then(m => ({ default: m.LogisticsPage })));
const DriverPanel = lazy(() => import('./components/DriverPanel').then(m => ({ default: m.DriverPanel })));
const WarehousePage = lazy(() => import('./components/WarehousePage'));
const SaunaCRMPage = lazy(() => import('./components/SaunaCRMPage'));
const PdfUploadDebugPage = lazy(() => import('./components/PdfUploadDebugPage'));
const FAQPage = lazy(() => import('./components/FAQPage'));
const FAQAdminComponent = lazy(() => import('./components/FAQPage').then(m => ({ default: m.FAQAdmin })));
const PDFTemplateEditor = lazy(() => import('./components/PDFTemplateEditor'));
const TrainingPage = lazy(() => import('./components/TrainingPage'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const AppContent = () => {
  const { i18n } = useTranslation();
  const { user, loading, isAdmin, hasAccess, logout, canViewPricing } = useAuth();
  const [currentCalculator, setCurrentCalculator] = useState(null);
  const [activeTab, setActiveTab] = useState('calculator');
  const [pricesUpdated, setPricesUpdated] = useState(0);
  const [editingOrder, setEditingOrder] = useState(null); // Order being edited in calculator
  const [amocrmPrefill, setAmocrmPrefill] = useState(null); // Pre-fill data from amoCRM

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

  // Fetch amoCRM lead data function
  const fetchAmocrmLeadData = async (leadId, section) => {
    try {
      // Smart API URL - auto-detect on production
      const getApiUrl = () => { 
        if (typeof window !== 'undefined') { 
          const o = window.location.origin; 
          if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
        } 
        return process.env.REACT_APP_BACKEND_URL || ''; 
      };
      const API_URL = getApiUrl();
      const response = await fetch(`${API_URL}/api/integrations/amocrm/lead/${leadId}?section=${section}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && data.lead) {
          setAmocrmPrefill(data.lead);
        }
      }
    } catch (error) {
      console.error('Error fetching amoCRM lead data:', error);
    }
  };

  // Load existing order for editing by amocrm_id
  const loadOrderForEdit = async (amocrmId, section) => {
    try {
      const getApiUrl = () => { 
        if (typeof window !== 'undefined') { 
          const o = window.location.origin; 
          if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
        } 
        return process.env.REACT_APP_BACKEND_URL || ''; 
      };
      const API_URL = getApiUrl();
      
      // Try to find order by amocrm_id
      const ordersEndpoint = section === 'sauna' ? '/api/sauna/orders' : '/api/orders';
      const response = await fetch(`${API_URL}${ordersEndpoint}`);
      
      if (response.ok) {
        const orders = await response.json();
        // Find order with matching amocrm_id
        const order = orders.find(o => o.amocrm_id === amocrmId || o.amocrm_id === String(amocrmId));
        
        if (order) {
          setEditingOrder(order);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading order for edit:', error);
      return false;
    }
  };

  // Check URL parameters for amoCRM integration and CRM prefill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calc = params.get('calc'); // Calculator type: balia or sauna
    const amocrmId = params.get('amocrm_id'); // amoCRM lead ID
    const crmLeadId = params.get('crmLeadId'); // CRM lead ID (from Sauna CRM)
    const prefillData = params.get('prefill'); // Prefill data JSON
    const debug = params.get('debug'); // Debug page
    
    // Handle debug page
    if (debug === 'pdf') {
      setCurrentCalculator('pdf_debug');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    if (calc && (calc === 'balia' || calc === 'sauna')) {
      // Set calculator type from URL
      setCurrentCalculator(calc);
      setActiveTab('calculator');
      
      const isEditMode = params.get('edit') === 'true';
      
      if (amocrmId) {
        if (isEditMode) {
          // Load existing order for editing
          loadOrderForEdit(amocrmId, calc).then(found => {
            if (!found) {
              // If order not found, just prefill from amoCRM
              fetchAmocrmLeadData(amocrmId, calc);
            }
          });
        } else {
          // Fetch lead data from amoCRM for new order
          fetchAmocrmLeadData(amocrmId, calc);
        }
      } else if (crmLeadId && prefillData) {
        // Direct prefill from Sauna CRM
        try {
          const parsedData = JSON.parse(prefillData);
          setAmocrmPrefill(parsedData);
        } catch (e) {
          console.error('Error parsing CRM prefill data:', e);
        }
      }
      
      // Clean URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Check for embed URL - show public calculator without auth
  const isEmbed = window.location.pathname.startsWith('/embed');
  if (isEmbed) {
    return (
      <Suspense fallback={<PageLoader />}>
        <EmbedBaliaCalculator />
        <Toaster position="top-center" richColors />
      </Suspense>
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

  // If user is a driver (role === 'driver'), automatically redirect to driver panel
  const isDriverOnly = user?.role === 'driver';
  
  // Landing Page - show calculator selection (or driver panel for drivers)
  if (!currentCalculator) {
    // Drivers automatically see driver panel without landing page
    if (isDriverOnly) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <Suspense fallback={<PageLoader />}>
            <DriverPanel onLogout={handleLogout} />
          </Suspense>
          <Toaster position="top-right" richColors />
        </div>
      );
    }
    
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
            <Suspense fallback={<PageLoader />}>
              <UserManagement />
            </Suspense>
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
          <Suspense fallback={<PageLoader />}>
            {activeTab === 'calculator' && <CalculatorPage key={pricesUpdated} editingOrder={editingOrder} onEditComplete={() => setEditingOrder(null)} amocrmPrefill={amocrmPrefill} onAmocrmPrefillUsed={() => setAmocrmPrefill(null)} />}
            {activeTab === 'orders' && <OrdersPage onEditInCalculator={(order) => handleEditOrderInCalculator(order, 'balia')} />}
            {activeTab === 'weborders' && <WebOrdersPage />}
            {activeTab === 'statistics' && <StatisticsPage calculatorType="balia" />}
            {activeTab === 'pricing' && canViewPricing() && <BaliaPricingPage />}
            {activeTab === 'embed' && isAdmin() && <EmbedCodePage />}
            {activeTab === 'users' && isAdmin() && <UserManagement />}
            {activeTab === 'faq' && <FAQPage calculatorType="balia" />}
            {activeTab === 'faq-admin' && isAdmin() && <FAQAdminComponent calculatorType="balia" />}
            {activeTab === 'training' && <TrainingPage user={user} />}
          </Suspense>
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
          <Suspense fallback={<PageLoader />}>
            <UserManagement />
          </Suspense>
        ) : activeTab === 'orders' ? (
          <Suspense fallback={<PageLoader />}>
            <OrdersPage calculatorType="sauna" onEditInCalculator={(order) => handleEditOrderInCalculator(order, 'sauna')} />
          </Suspense>
        ) : activeTab === 'statistics' ? (
          <Suspense fallback={<PageLoader />}>
            <StatisticsPage calculatorType="sauna" />
          </Suspense>
        ) : activeTab === 'pricing' && canViewPricing() ? (
          <Suspense fallback={<PageLoader />}>
            <SaunaPricingPage />
          </Suspense>
        ) : activeTab === 'techspec' && canViewPricing() ? (
          <Suspense fallback={<PageLoader />}>
            <TechSpecAdminPage />
          </Suspense>
        ) : activeTab === 'faq' ? (
          <Suspense fallback={<PageLoader />}>
            <FAQPage calculatorType="sauna" />
          </Suspense>
        ) : activeTab === 'faq-admin' && isAdmin() ? (
          <Suspense fallback={<PageLoader />}>
            <FAQAdminComponent calculatorType="sauna" />
          </Suspense>
        ) : activeTab === 'pdf-template' && isAdmin() ? (
          <Suspense fallback={<PageLoader />}>
            <PDFTemplateEditor calculatorType="sauna" />
          </Suspense>
        ) : activeTab === 'training' ? (
          <Suspense fallback={<PageLoader />}>
            <TrainingPage user={user} />
          </Suspense>
        ) : (
          <Suspense fallback={<PageLoader />}>
            <SaunaCalculator editingOrder={editingOrder} onEditComplete={() => setEditingOrder(null)} amocrmPrefill={amocrmPrefill} onAmocrmPrefillUsed={() => setAmocrmPrefill(null)} />
          </Suspense>
        )}
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Logistics Page
  if (currentCalculator === 'logistics') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isAdminAuthenticated={isAdmin()}
          onAdminLogout={handleLogout}
          showNavigation={false}
          showUsers={false}
          calculatorType="logistics"
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
        
        <Suspense fallback={<PageLoader />}>
          <LogisticsPage />
        </Suspense>
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Driver Panel
  if (currentCalculator === 'driver') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Suspense fallback={<PageLoader />}>
          <DriverPanel onLogout={handleLogout} />
        </Suspense>
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Warehouse Page
  if (currentCalculator === 'warehouse') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <LandingHeader 
          isAdmin={isAdmin()} 
          onLogout={handleLogout}
        />
        <Suspense fallback={<PageLoader />}>
          <WarehousePage onBack={handleBackToLanding} />
        </Suspense>
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Training Page
  if (currentCalculator === 'training') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isAdminAuthenticated={isAdmin()}
          onAdminLogout={handleLogout}
          showNavigation={false}
          showUsers={false}
          calculatorType="training"
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
        
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <Suspense fallback={<PageLoader />}>
            <TrainingPage user={user} />
          </Suspense>
        </div>
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Sauna CRM Page
  if (currentCalculator === 'sauna_crm') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isAdminAuthenticated={isAdmin()}
          onAdminLogout={handleLogout}
          showNavigation={false}
          showUsers={false}
          calculatorType="sauna_crm"
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
        
        <Suspense fallback={<PageLoader />}>
          <SaunaCRMPage />
        </Suspense>
        
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // PDF Upload Debug Page (accessible to admins)
  if (currentCalculator === 'pdf_debug' && isAdmin()) {
    return (
      <Suspense fallback={<PageLoader />}>
        <PdfUploadDebugPage />
      </Suspense>
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
        
        <Suspense fallback={<PageLoader />}>
          <AdminPanel 
            onBackToLanding={handleBackToLanding}
            onEditInCalculator={handleEditOrderInCalculator}
          />
        </Suspense>
        
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
