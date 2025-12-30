// WeatherType-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/services/Weather.md

import { z } from 'zod';
import { weatherTypeSchema } from '../../src/types/weather';

export const weatherTypePresetsSchema = z.array(weatherTypeSchema);

export const weatherTypePresets = weatherTypePresetsSchema.parse([
  { id: 'none', name: 'Klar', category: 'precipitation', severity: 0 },
  { id: 'drizzle', name: 'Nieselregen', category: 'precipitation', severity: 0.2 },
  { id: 'rain', name: 'Regen', category: 'precipitation', severity: 0.4 },
  { id: 'heavy_rain', name: 'Starkregen', category: 'precipitation', severity: 0.7 },
  { id: 'snow', name: 'Schnee', category: 'precipitation', severity: 0.5 },
  { id: 'blizzard', name: 'Schneesturm', category: 'precipitation', severity: 0.9 },
  { id: 'hail', name: 'Hagel', category: 'precipitation', severity: 0.8 },
]);

export default weatherTypePresets;
