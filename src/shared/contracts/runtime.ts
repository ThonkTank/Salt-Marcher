import { z } from 'zod'

export const coreProcessStatusSchema = z.enum([
  'starting',
  'ready',
  'recovering',
  'unavailable',
  'closed'
])

export type CoreProcessStatus = z.infer<typeof coreProcessStatusSchema>

export const rendererIncidentSchema = z
  .object({
    scope: z.enum(['shell', 'workspace', 'canvas']),
    workspace: z.enum(['application', 'session', 'catalog', 'hex']),
    phase: z.enum(['module-load', 'render', 'bootstrap', 'canvas']),
    code: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
    errorName: z.string().min(1).max(80),
    message: z.string().min(1).max(512),
    recoveryClass: z.enum([
      'retry-module',
      'remount-surface',
      'return-session',
      'reload-renderer'
    ])
  })
  .strict()

export type RendererIncident = z.infer<typeof rendererIncidentSchema>
