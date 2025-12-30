// WeatherType Entity
// Siehe: docs/services/Weather.md

import { z } from 'zod';
import { WEATHER_CATEGORIES } from '../constants/terrain';

export const weatherTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(WEATHER_CATEGORIES),
  severity: z.number().min(0).max(1), // 0 = mild, 1 = extreme
  description: z.string().optional(),
});

export type WeatherType = z.infer<typeof weatherTypeSchema>;
