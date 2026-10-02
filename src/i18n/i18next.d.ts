import 'i18next'
import type { resources } from './index'

// Type-checked translation keys: `t('tabs.discover')` compiles, typos do not.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: (typeof resources)['es']
  }
}
