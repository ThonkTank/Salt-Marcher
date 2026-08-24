import { useContext } from 'react'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import { CapabilityContext } from './capability-context.js'

export function useCapabilityApi(): SaltMarcherApi {
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Renderer capability provider is missing')
  return context.api
}
