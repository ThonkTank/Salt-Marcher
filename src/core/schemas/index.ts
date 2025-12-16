/**
 * Core schemas - Public API
 */

// Common schemas
export {
  entityIdSchema,
  timestampSchema,
  entityTypeSchema,
  timeSegmentSchema,
  appErrorSchema,
} from './common';

// Terrain schemas
export {
  terrainDefinitionSchema,
  type TerrainDefinition,
  TERRAIN_IDS,
  type BuiltinTerrainId,
} from './terrain';

// Map schemas
export {
  hexCoordSchema,
  type HexCoordinate,
  mapTypeSchema,
  type MapType,
  overworldTileSchema,
  type OverworldTile,
  overworldMapSchema,
  type OverworldMap,
  tileKey,
  buildTileLookup,
} from './map';

// Party schemas
export {
  transportModeSchema,
  type TransportMode,
  TRANSPORT_BASE_SPEEDS,
  partySchema,
  type Party,
  type PartyTravelState,
} from './party';

// Settings schemas
export {
  pluginSettingsSchema,
  type PluginSettings,
  DEFAULT_SETTINGS,
} from './settings';
