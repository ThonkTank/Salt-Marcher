import { lazy } from 'react'

export const LazyWorldFactionDialog = lazy(() =>
  import('./world-faction-dialog.js').then((module) => ({
    default: module.WorldFactionDialog
  }))
)
