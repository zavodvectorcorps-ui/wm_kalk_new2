import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Bath, Flame, ArrowRight } from 'lucide-react';

export const LandingPage = ({ onSelectCalculator }) => {
  const { t, i18n } = useTranslation();

  const texts = {
    ru: {
      title: 'Выберите калькулятор',
      subtitle: 'Выберите тип продукта для расчёта стоимости',
      baliaTitle: 'Купель (Balia)',
      baliaDesc: 'Калькулятор для конфигурации и расчёта стоимости купелей с джакузи',
      saunaTitle: 'Сауна (Sauna)',
      saunaDesc: 'Калькулятор для конфигурации и расчёта стоимости саун',
      select: 'Выбрать',
      comingSoon: 'Скоро',
    },
    pl: {
      title: 'Wybierz kalkulator',
      subtitle: 'Wybierz typ produktu do obliczenia ceny',
      baliaTitle: 'Balia',
      baliaDesc: 'Kalkulator do konfiguracji i wyceny bali z jacuzzi',
      saunaTitle: 'Sauna',
      saunaDesc: 'Kalkulator do konfiguracji i wyceny saun',
      select: 'Wybierz',
      comingSoon: 'Wkrótce',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Balia Card */}
          <Card 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/50"
            onClick={() => onSelectCalculator('balia')}
          >
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <Bath className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  {txt.baliaTitle}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {txt.baliaDesc}
                </p>
                <Button className="w-full gap-2 group-hover:gap-3 transition-all">
                  {txt.select}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sauna Card */}
          <Card 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-2 hover:border-orange-500/50"
            onClick={() => onSelectCalculator('sauna')}
          >
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-6 group-hover:bg-orange-500/20 transition-colors">
                  <Flame className="w-10 h-10 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  {txt.saunaTitle}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {txt.saunaDesc}
                </p>
                <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all border-orange-500/50 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600">
                  {txt.select}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
