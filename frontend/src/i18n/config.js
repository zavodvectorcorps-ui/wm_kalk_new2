import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ruTranslations from './locales/ru.json';
import plTranslations from './locales/pl.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: {
        translation: ruTranslations
      },
      pl: {
        translation: plTranslations
      }
    },
    lng: 'ru', // Default language
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
