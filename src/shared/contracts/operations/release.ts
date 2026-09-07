import { z } from 'zod'
import { backupSummarySchema, releaseStatusSchema } from '../release.js'
import { mainOperationFragment, none, read, write } from './registry.js'
const maintenanceDefinitions = {
  'updates.profiles': read(
    'updates:profiles',
    none,
    z.array(
      z
        .object({
          id: z.enum(['local', 'electron', 'development']),
          label: z.string()
        })
        .strict()
    ),
    ['gm']
  ),
  'updates.newProfile': write(
    'updates:new-profile',
    z.object({ confirmed: z.literal(true) }).strict(),
    releaseStatusSchema,
    ['gm'],
    null
  ),
  'updates.status': read('updates:status', none, releaseStatusSchema, ['gm']),
  'updates.check': write(
    'updates:check',
    none,
    releaseStatusSchema,
    ['gm'],
    null
  ),
  'updates.download': write(
    'updates:download',
    none,
    releaseStatusSchema,
    ['gm'],
    null
  ),
  'updates.install': write(
    'updates:install',
    z.object({ confirmed: z.literal(true) }).strict(),
    releaseStatusSchema,
    ['gm'],
    null
  ),
  'updates.setup': write(
    'updates:setup',
    z.object({ confirmed: z.literal(true) }).strict(),
    releaseStatusSchema,
    ['gm'],
    null
  ),
  'updates.importProfile': write(
    'updates:import-profile',
    z
      .object({
        confirmed: z.literal(true),
        id: z.enum(['local', 'electron', 'development']).optional()
      })
      .strict(),
    releaseStatusSchema,
    ['gm'],
    null
  ),
  'backups.list': read('backups:list', none, z.array(backupSummarySchema), [
    'gm'
  ]),
  'backups.restore': write(
    'backups:restore',
    z.object({ id: z.uuid(), confirmed: z.literal(true) }).strict(),
    releaseStatusSchema,
    ['gm'],
    null
  )
}
export const releaseOperationDefinitions = mainOperationFragment({
  ...maintenanceDefinitions,
  'updates.newProfile': {
    ...maintenanceDefinitions['updates.newProfile'],
    deadlineMs: 1_800_000
  },
  'updates.download': {
    ...maintenanceDefinitions['updates.download'],
    deadlineMs: 1_800_000
  },
  'updates.install': {
    ...maintenanceDefinitions['updates.install'],
    deadlineMs: 1_800_000
  },
  'updates.setup': {
    ...maintenanceDefinitions['updates.setup'],
    deadlineMs: 1_800_000
  },
  'updates.importProfile': {
    ...maintenanceDefinitions['updates.importProfile'],
    deadlineMs: 1_800_000
  },
  'backups.restore': {
    ...maintenanceDefinitions['backups.restore'],
    deadlineMs: 1_800_000
  }
})
