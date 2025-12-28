import React from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Calculator, FileText, DollarSign, LogOut, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const Header = ({ activeTab, onTabChange, isAdminAuthenticated, onAdminLogout }) => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">{t('appTitle')}</h1>
        </div>
        
        <nav className="hidden md:flex items-center gap-2">
          <Button
            variant={activeTab === 'calculator' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange('calculator')}
            className="flex items-center gap-2"
          >
            <Calculator className="h-4 w-4" />
            {t('calculator')}
          </Button>
          <Button
            variant={activeTab === 'orders' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange('orders')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            {t('orders')}
          </Button>
          <Button
            variant={activeTab === 'pricing' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange('pricing')}
            className="flex items-center gap-2 relative"
          >
            <DollarSign className="h-4 w-4" />
            {t('pricing')}
            {!isAdminAuthenticated && (
              <Lock className="h-3 w-3 ml-1" />
            )}
          </Button>
        </nav>
        
        <div className="flex items-center gap-2">
          {isAdminAuthenticated && (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                Админ
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdminLogout}
                className="text-muted-foreground hover:text-foreground"
                title="Выйти из режима администратора"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};
