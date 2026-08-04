import { useContext } from 'react'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import { CapabilityContext } from './capability-context.js'

export function useCapabilityApi(): SaltMarcherApi {
  const api = useContext(CapabilityContext)
  if (!api) throw new Error('Renderer capability provider is missing')
  return api
}
