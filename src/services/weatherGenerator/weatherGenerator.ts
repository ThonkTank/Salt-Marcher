// Ziel: Weather generieren aus Terrain-Ranges, Season, Time, Elevation
// Siehe: docs/services/Weather.md
//
// Pipeline:
// 1. Faktoren aus Terrain-Ranges samplen
// 2. Season/Time/Elevation Modifier anwenden
// 3. Passendes Event matchen (höchste Priorität gewinnt)
// 4. Weather-Objekt bauen

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Implementiere Area-Averaging für realistischeres Wetter
// - Spec: Weather.md#area-averaging
// - Nachbar-Tiles mitteln für sanftere Übergänge
// - Input: neighborTerrains?: TerrainDefinition[]
// - Priorität: niedrig (Post-MVP)
//
// [TODO]: Implementiere Weather-Transitions
// - Spec: Weather.md#weather-transitions
// - Interpolation zwischen altem und neuem Wetter
// - transitionWeather(current, target, speed): Weather
// - Priorität: niedrig (Post-MVP)

import { vault } from '@/infrastructure/vault/vaultInstance';
import { sampleFromRange } from '@/utils';
import type { Weather, WeatherFactors, WeatherEvent } from '#types/weather';
import { checkPreconditions, calculateSpecificity } from '#types/weather';
import type { TerrainDefinition } from '#types/entities/terrainDefinition';
import type { TimeSegment } from '@/constants/time';
import {
  SEASON_TEMPERATURE_OFFSET,
  TIME_TEMPERATURE_OFFSET,
  ELEVATION_TEMPERATURE_FACTOR,
  type Season,
} from '@/constants/weather';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[weatherGenerator]', ...args);
  }
};

// ============================================================================
// FALLBACK EVENT
// ============================================================================

/**
 * Fallback-Event wenn kein anderes Event matcht.
 * Hat Spezifität 0 (keine Preconditions) - wird nur gewählt wenn nichts anderes passt.
 */
const FALLBACK_EVENT: WeatherEvent = {
  id: 'fallback',
  name: 'Bewölkt',
  preconditions: {},
  effects: {
    visibilityModifier: 0.9,
    travelSpeedModifier: 1.0,
  },
  description: 'Grauer Himmel mit durchziehenden Wolken.',
  tags: ['fallback'],
};

// ============================================================================
// HAUPT-FUNKTION
// ============================================================================

/**
 * Generiert Weather basierend auf Terrain, Season, Time und Elevation.
 *
 * @param input.terrain - Terrain-ID oder vollständige TerrainDefinition
 * @param input.season - Jahreszeit (spring, summer, autumn, winter)
 * @param input.timeSegment - Tageszeit (dawn, morning, midday, afternoon, dusk, night)
 * @param input.elevation - Höhe in Metern (optional, default 0)
 * @param input.seed - Seed für deterministische Generierung (optional)
 *
 * @returns Weather-Objekt mit Faktoren, Event und Convenience-Feldern
 */
export function generateWeather(input: {
  terrain: { id: string } | TerrainDefinition;
  season: Season;
  timeSegment: TimeSegment;
  elevation?: number;
  seed?: number;
}): Weather {
  // Terrain aus Vault laden wenn nur ID übergeben wurde
  const terrain = 'weatherRanges' in input.terrain
    ? input.terrain as TerrainDefinition
    : vault.getEntity<TerrainDefinition>('terrain', input.terrain.id);

  debug('Input:', {
    terrain: terrain.id,
    season: input.season,
    timeSegment: input.timeSegment,
    elevation: input.elevation ?? 0,
    seed: input.seed,
  });

  // Step 1+2: Faktoren generieren (inkl. Modifier)
  const factors = generateFactors({ ...input, terrain });
  debug('Generated factors:', factors);

  // Step 3: Passendes Event matchen
  const event = matchWeatherEvent(factors, terrain.id);
  debug('Matched event:', event.id, event.name);

  // Step 4: Weather-Objekt bauen
  return {
    factors,
    event,
    visibilityModifier: event.effects.visibilityModifier,
    travelSpeedModifier: event.effects.travelSpeedModifier ?? 1.0,
  };
}

// ============================================================================
// FAKTOR-GENERIERUNG
// ============================================================================

/**
 * Generiert WeatherFactors aus Terrain-Ranges + Modifiern.
 */
function generateFactors(input: {
  terrain: TerrainDefinition;
  season: Season;
  timeSegment: TimeSegment;
  elevation?: number;
  seed?: number;
}): WeatherFactors {
  const ranges = input.terrain.weatherRanges;
  const baseSeed = input.seed ?? Date.now();

  // Basis-Werte aus Terrain-Ranges samplen
  let temperature = sampleFromRange(ranges.temperature, baseSeed);
  const humidity = sampleFromRange(ranges.humidity, baseSeed + 1);
  const wind = sampleFromRange(ranges.wind, baseSeed + 2);
  const pressure = sampleFromRange(ranges.pressure, baseSeed + 3);
  const cloudCover = sampleFromRange(ranges.cloudCover, baseSeed + 4);

  debug('Base values:', { temperature, humidity, wind, pressure, cloudCover });

  // Season-Modifier anwenden
  const seasonOffset = SEASON_TEMPERATURE_OFFSET[input.season] ?? 0;
  temperature += seasonOffset;
  debug('After season offset:', temperature, `(${input.season}: ${seasonOffset > 0 ? '+' : ''}${seasonOffset})`);

  // Time-Modifier anwenden
  const timeOffset = TIME_TEMPERATURE_OFFSET[input.timeSegment] ?? 0;
  temperature += timeOffset;
  debug('After time offset:', temperature, `(${input.timeSegment}: ${timeOffset > 0 ? '+' : ''}${timeOffset})`);

  // Elevation-Modifier anwenden
  if (input.elevation && input.elevation > 0) {
    const elevationOffset = (input.elevation / 1000) * ELEVATION_TEMPERATURE_FACTOR;
    temperature += elevationOffset;
    debug('After elevation offset:', temperature, `(${input.elevation}m: ${elevationOffset.toFixed(1)})`);
  }

  return {
    temperature: Math.round(temperature * 10) / 10, // 1 Dezimalstelle
    humidity: Math.round(humidity),
    wind: Math.round(wind),
    pressure: Math.round(pressure * 100) / 100, // 2 Dezimalstellen
    cloudCover: Math.round(cloudCover * 100) / 100,
  };
}

// ============================================================================
// EVENT-MATCHING
// ============================================================================

/**
 * Findet das passende Weather-Event für die gegebenen Faktoren.
 * Höchste Spezifität gewinnt bei mehreren Matches.
 */
function matchWeatherEvent(factors: WeatherFactors, terrainId: string): WeatherEvent {
  const allEvents = vault.getAllEntities<WeatherEvent>('weatherEvent');
  debug('Total events in vault:', allEvents.length);

  // Alle Events filtern die matchen und Spezifität berechnen
  const matches = allEvents
    .filter(event => checkPreconditions(event.preconditions, factors, terrainId))
    .map(event => {
      const specificity = calculateSpecificity(event.preconditions);
      debug('Event matches:', event.id, 'specificity:', specificity.toFixed(2));
      return { event, specificity };
    })
    .sort((a, b) => b.specificity - a.specificity);

  debug('Matching events:', matches.length);

  if (matches.length === 0) {
    debug('No events match, using fallback');
    return FALLBACK_EVENT;
  }

  const selected = matches[0];
  debug('Selected event:', selected.event.id, 'specificity:', selected.specificity.toFixed(2));

  return selected.event;
}
