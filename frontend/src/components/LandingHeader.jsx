import React from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Calculator } from 'lucide-react';
import GlobalSyncPill from './GlobalSyncPill';

export const LandingHeader = () => {
  const { i18n } = useTranslation();

  const titles = {
    ru: 'WM калькулятор',
    pl: 'WM kalkulator',
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight">{titles[lang]}</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <GlobalSyncPill compact />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};
