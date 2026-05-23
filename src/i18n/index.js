import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import uiVi from './locales/vi/ui.json';
import statusVi from './locales/vi/status.json';
import messagesVi from './locales/vi/messages.json';
import validationVi from './locales/vi/validation.json';
import printVi from './locales/vi/print.json';
import navVi from './locales/vi/nav.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: 'vi',
    fallbackLng: 'vi',
    defaultNS: 'ui',
    ns: ['ui', 'status', 'messages', 'validation', 'print', 'nav'],
    resources: {
      vi: {
        ui: uiVi,
        status: statusVi,
        messages: messagesVi,
        validation: validationVi,
        print: printVi,
        nav: navVi,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
