import {
  installationSettingsSchema,
  updateInstallationSettingsInputSchema
} from '../settings.js'
import { none, read, utilityOperationFragment, write } from './registry.js'

export const settingsOperationDefinitions = utilityOperationFragment({
  'settings.read': read('settings:read', none, installationSettingsSchema),
  'settings.update': write(
    'settings:update',
    updateInstallationSettingsInputSchema,
    installationSettingsSchema,
    ['gm'],
    null
  )
})
