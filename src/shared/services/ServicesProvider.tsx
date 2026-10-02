import { createContext, use, type ReactNode } from 'react'
import type { AppServices } from './services'

const ServicesContext = createContext<AppServices | null>(null)

export function ServicesProvider({
  services,
  children,
}: {
  services: AppServices
  children: ReactNode
}) {
  return <ServicesContext value={services}>{children}</ServicesContext>
}

export function useServices(): AppServices {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>')
  return services
}
