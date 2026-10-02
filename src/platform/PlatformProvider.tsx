import { createContext, use, type ReactNode } from 'react'
import type { Platform } from './platform'

const PlatformContext = createContext<Platform | null>(null)

export function PlatformProvider({
  platform,
  children,
}: {
  platform: Platform
  children: ReactNode
}) {
  return <PlatformContext value={platform}>{children}</PlatformContext>
}

export function usePlatform(): Platform {
  const platform = use(PlatformContext)
  if (!platform) throw new Error('usePlatform must be used inside <PlatformProvider>')
  return platform
}
