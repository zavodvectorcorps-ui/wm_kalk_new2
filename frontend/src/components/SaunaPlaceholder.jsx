import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import { Flame, Construction } from 'lucide-react';

export const SaunaPlaceholder = () => {
  const { i18n } = useTranslation();

  const texts = {
    ru: {
      title: 'Калькулятор сауны',
      subtitle: 'Этот раздел находится в разработке',
      description: 'Калькулятор для конфигурации и расчёта стоимости саун скоро будет доступен.',
    },
    pl: {
      title: 'Kalkulator sauny',
      subtitle: 'Ta sekcja jest w trakcie budowy',
      description: 'Kalkulator do konfiguracji i wyceny saun będzie wkrótce dostępny.',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="shadow-lg">
        <CardContent className="p-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-orange-500/10 flex items-center justify-center mb-6">
              <Flame className="w-12 h-12 text-orange-500" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">
              {txt.title}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Construction className="w-5 h-5" />
              <p className="text-lg">{txt.subtitle}</p>
            </div>
            <p className="text-muted-foreground max-w-md">
              {txt.description}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
