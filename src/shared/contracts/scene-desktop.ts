import { z } from 'zod'

export const desktopBoundsSchema = z
  .object({
    x: z.number().int().min(0).max(100_000),
    y: z.number().int().min(0).max(100_000),
    width: z.number().int().min(240).max(100_000),
    height: z.number().int().min(160).max(100_000)
  })
  .strict()
  .readonly()

export const sceneDesktopWindowSchema = z
  .object({
    id: z.literal('overview'),
    kind: z.literal('overview'),
    bounds: desktopBoundsSchema,
    minimized: z.boolean(),
    maximized: z.boolean(),
    snap: z.enum(['left', 'right']).nullable()
  })
  .strict()
  .readonly()

// Array order is the back-to-front order. Empty is a deliberately closed desktop.
export const sceneDesktopStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    windows: z.array(sceneDesktopWindowSchema).max(1).readonly()
  })
  .strict()
  .readonly()

const scopeShape = { campaignId: z.uuid(), sceneId: z.uuid() }

export const sceneDesktopScopeSchema = z.object(scopeShape).strict().readonly()

export const sceneDesktopSnapshotSchema = z
  .object({
    ...scopeShape,
    revision: z.number().int().nonnegative().safe(),
    state: sceneDesktopStateSchema.nullable()
  })
  .strict()
  .readonly()

export const saveSceneDesktopInputSchema = z
  .object({
    ...scopeShape,
    expectedRevision: z.number().int().nonnegative().safe(),
    state: sceneDesktopStateSchema
  })
  .strict()
  .readonly()

export type DesktopBounds = z.infer<typeof desktopBoundsSchema>
export type SceneDesktopWindow = z.infer<typeof sceneDesktopWindowSchema>
export type SceneDesktopState = z.infer<typeof sceneDesktopStateSchema>
export type SceneDesktopScope = z.infer<typeof sceneDesktopScopeSchema>
export type SceneDesktopSnapshot = z.infer<typeof sceneDesktopSnapshotSchema>
export type SaveSceneDesktopInput = z.infer<typeof saveSceneDesktopInputSchema>
