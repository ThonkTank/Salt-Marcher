import { lazy, Suspense, type ComponentProps } from 'react'

const WorldFactionCreation = lazy(async () => {
  const module = await import('./integrated-related-creation.js')
  return { default: module.IntegratedWorldFactionCreation }
})

const EncounterTableCreation = lazy(async () => {
  const module = await import('./integrated-related-creation.js')
  return { default: module.IntegratedEncounterTableCreation }
})

export function LazyIntegratedWorldFactionCreation(
  props: ComponentProps<typeof WorldFactionCreation>
) {
  return (
    <Suspense fallback={null}>
      <WorldFactionCreation {...props} />
    </Suspense>
  )
}

export function LazyIntegratedEncounterTableCreation(
  props: ComponentProps<typeof EncounterTableCreation>
) {
  return (
    <Suspense fallback={null}>
      <EncounterTableCreation {...props} />
    </Suspense>
  )
}
