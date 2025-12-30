// Zeit-Typen für Kalender/Zeit-System
// Siehe: docs/features/Time.md

import { z } from 'zod';
import { TIME_SEGMENTS } from '../constants/time';

// ============================================================================
// GAME DATE TIME
// ============================================================================

// Schema für Tages-Segment (für Komposition in anderen Schemas)
export const timeSegmentSchema = z.enum(TIME_SEGMENTS);

export const gameDateTimeSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59).optional(),
  segment: timeSegmentSchema,
});

export type GameDateTime = z.infer<typeof gameDateTimeSchema>;
