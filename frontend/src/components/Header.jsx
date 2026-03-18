import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Calculator, FileText, DollarSign, LogOut, Lock, Menu, X, Users, Waves, Flame, Settings, BarChart3, Globe, Code, HelpCircle, FileImage, GraduationCap, ShoppingCart, Briefcase } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const Header = ({ 
  activeTab, 
  onTabChange, 
  isAdminAuthenticated, 
  onAdminLogout,
  showNavigation = true,
  showUsers = false,
  calculatorType = null
}) => {
  const { t, i18n } = useTranslation();
  const { canViewPricing } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const texts = {
    ru: {
      users: 'Сотрудники',
      wmCalculator: 'WM калькулятор',
      wmBalia: 'WM-Balia',
      wmSauna: 'WM-Sauna',
      techSpec: 'Тех.Задание',
      statistics: 'Статистика',
    },
    pl: {
      users: 'Pracownicy',
      wmCalculator: 'WM kalkulator',
      wmBalia: 'WM-Balia',
      wmSauna: 'WM-Sauna',
      techSpec: 'Spec.Tech.',
      statistics: 'Statystyki',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Determine title and icon based on calculator type
  const getHeaderConfig = () => {
    if (calculatorType === 'balia') {
      return {
        title: txt.wmBalia,
        icon: <Waves className="h-6 w-6 text-primary" />,
        iconBg: 'bg-primary/10',
      };
    } else if (calculatorType === 'sauna') {
      return {
        title: txt.wmSauna,
        icon: <Flame className="h-6 w-6 text-orange-500" />,
        iconBg: 'bg-orange-500/10',
      };
    } else {
      return {
        title: txt.wmCalculator,
        icon: <Calculator className="h-6 w-6 text-primary" />,
        iconBg: 'bg-primary/10',
      };
    }
  };

  const headerConfig = getHeaderConfig();

  const handleTabChange = (tab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        {/* Logo and Title */}
        <div className="flex items-center gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${headerConfig.iconBg}`}>
            {headerConfig.icon}
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight">{headerConfig.title}</h1>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          {showNavigation && (
            <>
              <Button
                variant={activeTab === 'calculator' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('calculator')}
                className="flex items-center gap-2"
              >
                <Calculator className="h-4 w-4" />
                {t('calculator')}
              </Button>
              <Button
                variant={activeTab === 'orders' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('orders')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {t('orders')}
              </Button>
              {calculatorType === 'balia' && (
                <Button
                  variant={activeTab === 'weborders' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('weborders')}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  {i18n.language === 'pl' ? 'Internet' : 'Интернет'}
                </Button>
              )}
              <Button
                variant={activeTab === 'statistics' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('statistics')}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                {txt.statistics}
              </Button>
              {(isAdminAuthenticated || canViewPricing()) && (
                <Button
                  variant={activeTab === 'pricing' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('pricing')}
                  className="flex items-center gap-2"
                >
                  <DollarSign className="h-4 w-4" />
                  {t('pricing')}
                </Button>
              )}
              {calculatorType === 'balia' && isAdminAuthenticated && (
                <Button
                  variant={activeTab === 'embed' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('embed')}
                  className="flex items-center gap-2"
                >
                  <Code className="h-4 w-4" />
                  {i18n.language === 'pl' ? 'Kod' : 'Код'}
                </Button>
              )}
              {/* FAQ Button */}
              {showNavigation && (
                <Button
                  variant={activeTab === 'faq' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('faq')}
                  className="flex items-center gap-2"
                >
                  <HelpCircle className="h-4 w-4" />
                  FAQ
                </Button>
              )}
              {/* FAQ Admin - only for admins */}
              {showNavigation && isAdminAuthenticated && (
                <Button
                  variant={activeTab === 'faq-admin' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('faq-admin')}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  FAQ ⚙
                </Button>
              )}
              {/* PDF Template - only for sauna admins */}
              {calculatorType === 'sauna' && isAdminAuthenticated && (
                <Button
                  variant={activeTab === 'pdf-template' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('pdf-template')}
                  className="flex items-center gap-2"
                >
                  <FileImage className="h-4 w-4" />
                  {i18n.language === 'pl' ? 'Szablon PDF' : 'Шаблон PDF'}
                </Button>
              )}
              {/* Layout Configurator - for all sauna users */}
              {calculatorType === 'sauna' && (
                <Button
                  variant={activeTab === 'layout-configurator' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('layout-configurator')}
                  className="flex items-center gap-2"
                  data-testid="layout-configurator-menu-btn"
                >
                  <Settings className="h-4 w-4" />
                  {i18n.language === 'pl' ? 'Planowki' : 'Планировки'}
                </Button>
              )}
              {/* Sales - only for sauna admins */}
              {calculatorType === 'sauna' && isAdminAuthenticated && (
                <Button
                  variant={activeTab === 'sales' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('sales')}
                  className="flex items-center gap-2"
                  data-testid="sales-tab-btn"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {i18n.language === 'pl' ? 'Sprzedaż' : 'Продажи'}
                </Button>
              )}
              {/* CRM - only for sauna admins */}
              {calculatorType === 'sauna' && isAdminAuthenticated && (
                <Button
                  variant={activeTab === 'crm' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('crm')}
                  className="flex items-center gap-2"
                  data-testid="crm-tab-btn"
                >
                  <Briefcase className="h-4 w-4" />
                  CRM
                </Button>
              )}
            </>
          )}
          {showUsers && isAdminAuthenticated && (
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('users')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              {txt.users}
            </Button>
          )}
        </nav>
        
        {/* Right side: Admin badge, Language Switcher, Mobile Menu Button */}
        <div className="flex items-center gap-2">
          {/* Desktop Admin Badge and Logout */}
          {isAdminAuthenticated ? (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                Admin
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdminLogout}
                className="text-muted-foreground hover:text-foreground"
                title={t('logout')}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            /* Logout button for regular employees */
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdminLogout}
              className="hidden md:flex text-muted-foreground hover:text-foreground"
              title={t('logout')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          
          <LanguageSwitcher />
          
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-card">
          <nav className="container px-4 py-3 space-y-1 mx-auto max-w-7xl">
            {showNavigation && (
              <>
                <Button
                  variant={activeTab === 'calculator' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('calculator')}
                  className="w-full justify-start gap-2"
                >
                  <Calculator className="h-4 w-4" />
                  {t('calculator')}
                </Button>
                <Button
                  variant={activeTab === 'orders' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('orders')}
                  className="w-full justify-start gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {t('orders')}
                </Button>
                {calculatorType === 'balia' && (
                  <Button
                    variant={activeTab === 'weborders' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange('weborders')}
                    className="w-full justify-start gap-2"
                  >
                    <Globe className="h-4 w-4" />
                    {i18n.language === 'pl' ? 'Internet' : 'Интернет'}
                  </Button>
                )}
                <Button
                  variant={activeTab === 'statistics' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('statistics')}
                  className="w-full justify-start gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  {txt.statistics}
                </Button>
                {(isAdminAuthenticated || canViewPricing()) && (
                  <Button
                    variant={activeTab === 'pricing' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange('pricing')}
                    className="w-full justify-start gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    {t('pricing')}
                  </Button>
                )}
                {calculatorType === 'balia' && isAdminAuthenticated && (
                  <Button
                    variant={activeTab === 'embed' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange('embed')}
                    className="w-full justify-start gap-2"
                  >
                    <Code className="h-4 w-4" />
                    {i18n.language === 'pl' ? 'Kod' : 'Код'}
                  </Button>
                )}
                {/* FAQ in mobile menu */}
                <Button
                  variant={activeTab === 'faq' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTabChange('faq')}
                  className="w-full justify-start gap-2"
                >
                  <HelpCircle className="h-4 w-4" />
                  FAQ
                </Button>
                {isAdminAuthenticated && (
                  <Button
                    variant={activeTab === 'faq-admin' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange('faq-admin')}
                    className="w-full justify-start gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    FAQ ⚙
                  </Button>
                )}
                {/* PDF Template - only for sauna admins */}
                {calculatorType === 'sauna' && isAdminAuthenticated && (
                  <Button
                    variant={activeTab === 'pdf-template' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange('pdf-template')}
                    className="w-full justify-start gap-2"
                  >
                    <FileImage className="h-4 w-4" />
                    {i18n.language === 'pl' ? 'Szablon PDF' : 'Шаблон PDF'}
                  </Button>
                )}
                {/* Layout Configurator - for all sauna users */}
                {calculatorType === 'sauna' && (
                  <Button
                    variant={activeTab === 'layout-configurator' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange('layout-configurator')}
                    className="w-full justify-start gap-2"
                    data-testid="layout-configurator-menu-btn-mobile"
                  >
                    <Settings className="h-4 w-4" />
                    {i18n.language === 'pl' ? 'Planowki' : 'Планировки'}
                  </Button>
                )}
                {/* Sales - only for sauna admins */}
                {calculatorType === 'sauna' && isAdminAuthenticated && (
                  <Button
                    variant={activeTab === 'sales' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange('sales')}
                    className="w-full justify-start gap-2"
                    data-testid="sales-tab-btn-mobile"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {i18n.language === 'pl' ? 'Sprzedaż' : 'Продажи'}
                  </Button>
                )}
                {/* CRM - only for sauna admins */}
                {calculatorType === 'sauna' && isAdminAuthenticated && (
                  <Button
                    variant={activeTab === 'crm' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange('crm')}
                    className="w-full justify-start gap-2"
                    data-testid="crm-tab-btn-mobile"
                  >
                    <Briefcase className="h-4 w-4" />
                    CRM
                  </Button>
                )}
              </>
            )}
            {showUsers && isAdminAuthenticated && (
              <Button
                variant={activeTab === 'users' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('users')}
                className="w-full justify-start gap-2"
              >
                <Users className="h-4 w-4" />
                {txt.users}
              </Button>
            )}
            
            {/* Mobile Admin Section */}
            {isAdminAuthenticated ? (
              <div className="pt-2 mt-2 border-t flex items-center justify-between">
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Admin
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onAdminLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-muted-foreground hover:text-foreground gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </Button>
              </div>
            ) : (
              /* Mobile Logout for regular employees */
              <div className="pt-2 mt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onAdminLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start text-muted-foreground hover:text-foreground gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
