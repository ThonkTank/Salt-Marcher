import type { ReactNode } from 'react'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import { CapabilityContext } from './capability-context.js'

export function CapabilityProvider(props: {
  api: SaltMarcherApi
  children: ReactNode
}) {
  return (
    <CapabilityContext.Provider value={props.api}>
      {props.children}
    </CapabilityContext.Provider>
  )
}
