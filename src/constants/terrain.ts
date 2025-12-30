// Terrain-/Map-bezogene Konstanten
// Siehe: docs/entities/terrain-definition.md, docs/entities/map.md

// Map-Kategorien
export const MAP_TYPES = ['overworld', 'town', 'dungeon'] as const;
export type MapType = typeof MAP_TYPES[number];

// Wind-Exposition für Tile-Klima
export const WIND_EXPOSURES = ['sheltered', 'normal', 'exposed'] as const;
export type WindExposure = typeof WIND_EXPOSURES[number];

// Environmental Encounter Pool-Typen
export const ENVIRONMENTAL_POOL_TYPES = ['location', 'local'] as const;
export type EnvironmentalPoolType = typeof ENVIRONMENTAL_POOL_TYPES[number];

// Wetter-Phänomen-Kategorien
export const WEATHER_CATEGORIES = ['precipitation', 'temperature', 'wind'] as const;
export type WeatherCategory = typeof WEATHER_CATEGORIES[number];
