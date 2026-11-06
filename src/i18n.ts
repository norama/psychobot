import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import cs from './locales/cs.json'

// Czech is the fixed active and fallback language for the demo. Plural keys
// use the _one/_few/_many/_other suffixes, and {{value, number}} or
// {{value, datetime}} interpolations format using the Intl APIs for `cs`.
const resources = { cs: { translation: cs } }

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof cs }
  }
}

i18next.use(initReactI18next).init({
  resources,
  lng: 'cs',
  fallbackLng: 'cs',
  supportedLngs: ['cs'],
  interpolation: { escapeValue: false },
})

export default i18next
