import { createContext } from 'react'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'

export const CapabilityContext = createContext<SaltMarcherApi | null>(null)
