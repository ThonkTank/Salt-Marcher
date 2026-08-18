import {
  installationSettingsSchema,
  updateInstallationSettingsInputSchema
} from '../settings.js'
import { none, read, write } from './registry.js'

export const settingsOperationDefinitions = {
  'settings.read': read('settings:read', none, installationSettingsSchema),
  'settings.update': write(
    'settings:update',
    updateInstallationSettingsInputSchema,
    installationSettingsSchema
  )
} as const
