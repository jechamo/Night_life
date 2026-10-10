import { App } from '@capacitor/app'
import { listen } from '../native-listener'
import type { AppStateService } from './app-state'

export function createNativeAppState(): AppStateService {
  return {
    onActiveChange: (handler) =>
      listen(() => App.addListener('appStateChange', ({ isActive }) => handler(isActive))),
    onBackButton: (handler) => listen(() => App.addListener('backButton', () => handler())),
    exit: () => void App.exitApp(),
  }
}
