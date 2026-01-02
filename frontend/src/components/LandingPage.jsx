import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Waves, Flame, ArrowRight, Lock, Shield } from 'lucide-react';

export const LandingPage = ({ onSelectCalculator, hasAccess }) => {
  const { i18n } = useTranslation();
  const { isAdmin } = useAuth();

  const texts = {
    ru: {
      title: 'Выберите калькулятор',
      subtitle: 'Выберите тип продукта для расчёта стоимости',
      baliaTitle: 'Купель (Balia)',
      baliaDesc: 'Калькулятор для конфигурации и расчёта стоимости купелей с джакузи',
      saunaTitle: 'Сауна (Sauna)',
      saunaDesc: 'Калькулятор для конфигурации и расчёта стоимости саун',
      adminTitle: 'Админ панель',
      adminDesc: 'Управление всеми заказами, статистика и настройки цен',
      select: 'Выбрать',
      comingSoon: 'Скоро',
      noAccess: 'Нет доступа',
    },
    pl: {
      title: 'Wybierz kalkulator',
      subtitle: 'Wybierz typ produktu do obliczenia ceny',
      baliaTitle: 'Balia',
      baliaDesc: 'Kalkulator do konfiguracji i wyceny bali z jacuzzi',
      saunaTitle: 'Sauna',
      saunaDesc: 'Kalkulator do konfiguracji i wyceny saun',
      adminTitle: 'Panel administracyjny',
      adminDesc: 'Zarządzanie wszystkimi zamówieniami, statystyki i ustawienia cen',
      select: 'Wybierz',
      comingSoon: 'Wkrótce',
      noAccess: 'Brak dostępu',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  const canAccessBalia = hasAccess ? hasAccess('balia') : true;
  const canAccessSauna = hasAccess ? hasAccess('sauna') : true;
  const canAccessAdmin = isAdmin && isAdmin();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {txt.title}
          </h1>
          <p className="text-muted-foreground text-lg">
            {txt.subtitle}
          </p>
        </div>

        {/* Calculator Cards */}
        <div className={`grid grid-cols-1 gap-6 ${canAccessAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-4xl mx-auto'}`}>
          {/* Balia Card */}
          <Card 
            className={`group transition-all duration-300 border-2 ${
              canAccessBalia 
                ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-primary/50' 
                : 'opacity-60 cursor-not-allowed'
            }`}
            onClick={() => canAccessBalia && onSelectCalculator('balia')}
          >
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${
                  canAccessBalia 
                    ? 'bg-primary/10 group-hover:bg-primary/20' 
                    : 'bg-muted'
                }`}>
                  {canAccessBalia ? (
                    <Waves className="w-10 h-10 text-primary" />
                  ) : (
                    <Lock className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  {txt.baliaTitle}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {txt.baliaDesc}
                </p>
                {canAccessBalia ? (
                  <Button className="w-full gap-2 group-hover:gap-3 transition-all">
                    {txt.select}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button disabled className="w-full gap-2" variant="secondary">
                    <Lock className="w-4 h-4" />
                    {txt.noAccess}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sauna Card */}
          <Card 
            className={`group transition-all duration-300 border-2 ${
              canAccessSauna 
                ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-orange-500/50' 
                : 'opacity-60 cursor-not-allowed'
            }`}
            onClick={() => canAccessSauna && onSelectCalculator('sauna')}
          >
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${
                  canAccessSauna 
                    ? 'bg-orange-500/10 group-hover:bg-orange-500/20' 
                    : 'bg-muted'
                }`}>
                  {canAccessSauna ? (
                    <Flame className="w-10 h-10 text-orange-500" />
                  ) : (
                    <Lock className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  {txt.saunaTitle}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {txt.saunaDesc}
                </p>
                {canAccessSauna ? (
                  <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-orange-500/50 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600">
                    {txt.select}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button disabled className="w-full gap-2" variant="secondary">
                    <Lock className="w-4 h-4" />
                    {txt.noAccess}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Admin Panel Card - Only visible for admins */}
          {canAccessAdmin && (
            <Card 
              className="group transition-all duration-300 border-2 cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-purple-500/50"
              onClick={() => onSelectCalculator('admin')}
            >
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors bg-purple-500/10 group-hover:bg-purple-500/20">
                    <Shield className="w-10 h-10 text-purple-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3">
                    {txt.adminTitle}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {txt.adminDesc}
                  </p>
                  <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-purple-500/50 text-purple-600 hover:bg-purple-500/10 hover:text-purple-600">
                    {txt.select}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
