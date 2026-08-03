import { z } from 'zod'

export const coreProcessStatusSchema = z.enum([
  'starting',
  'ready',
  'recovering',
  'unavailable',
  'closed'
])

export type CoreProcessStatus = z.infer<typeof coreProcessStatusSchema>
