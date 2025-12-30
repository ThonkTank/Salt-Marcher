// Vault-persistierte GroupTemplate
// Siehe: docs/entities/group-template.md

import { z } from 'zod';
import { designRoleSchema } from './creature';

// ============================================================================
// SLOT COUNT SCHEMAS
// ============================================================================

/**
 * Drei Formate fuer Slot-Anzahl:
 * - Feste Zahl: count: 1
 * - Gleichverteilung: { min: 2, max: 4 }
 * - Normalverteilung: { min: 2, avg: 4, max: 10 }
 */
export const slotCountUniformSchema = z.object({
  min: z.number().int().min(0),
  max: z.number().int().min(1),
});
export type SlotCountUniform = z.infer<typeof slotCountUniformSchema>;

export const slotCountNormalSchema = z.object({
  min: z.number().int().min(0),
  avg: z.number().int().min(1),
  max: z.number().int().min(1),
});
export type SlotCountNormal = z.infer<typeof slotCountNormalSchema>;

export const slotCountSchema = z.union([
  z.number().int().min(0),
  slotCountUniformSchema,
  slotCountNormalSchema,
]);
export type SlotCount = z.infer<typeof slotCountSchema>;

// ============================================================================
// SLOT DEFINITION
// ============================================================================

export const slotDefSchema = z.object({
  designRole: designRoleSchema,
  count: slotCountSchema,
});
export type SlotDef = z.infer<typeof slotDefSchema>;

// ============================================================================
// GROUP TEMPLATE
// ============================================================================

export const groupTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  slots: z.record(slotDefSchema),
});

export type GroupTemplate = z.infer<typeof groupTemplateSchema>;
