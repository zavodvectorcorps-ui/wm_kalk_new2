import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Calculator, FileText, DollarSign, LogOut, Lock, Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const Header = ({ activeTab, onTabChange, isAdminAuthenticated, onAdminLogout }) => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabChange = (tab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        {/* Logo and Title */}
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight">{t('appTitle')}</h1>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
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
          <Button
            variant={activeTab === 'pricing' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('pricing')}
            className="flex items-center gap-2 relative"
          >
            <DollarSign className="h-4 w-4" />
            {t('pricing')}
            {!isAdminAuthenticated && (
              <Lock className="h-3 w-3 ml-1" />
            )}
          </Button>
        </nav>
        
        {/* Right side: Admin badge, Language Switcher, Mobile Menu Button */}
        <div className="flex items-center gap-2">
          {/* Desktop Admin Badge */}
          {isAdminAuthenticated && (
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
            <Button
              variant={activeTab === 'pricing' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('pricing')}
              className="w-full justify-start gap-2"
            >
              <DollarSign className="h-4 w-4" />
              {t('pricing')}
              {!isAdminAuthenticated && (
                <Lock className="h-3 w-3 ml-1" />
              )}
            </Button>
            
            {/* Mobile Admin Section */}
            {isAdminAuthenticated && (
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
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
