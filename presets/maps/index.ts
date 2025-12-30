// Map-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/entities/map.md

import { z } from 'zod';
import { mapDefinitionSchema } from '../../src/types/entities/map';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const mapPresetSchema = mapDefinitionSchema;
export const mapPresetsSchema = z.array(mapPresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const mapPresets = mapPresetsSchema.parse([
  {
    id: 'test-map',
    name: 'Test Overworld',
    type: 'overworld',
    defaultSpawnPoint: { q: 0, r: 0 },
    description: 'Test-Map für CLI-Testing',
  },
]);

export default mapPresets;
