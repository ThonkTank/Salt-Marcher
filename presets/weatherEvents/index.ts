// Weather-Event Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/services/Weather.md
//
// Events werden über Preconditions gematcht.
// Spezifischere Preconditions = höhere Priorität (dynamisch berechnet).
// Fallback-Events (leere Preconditions) matchen wenn nichts anderes passt.

import { z } from 'zod';
import { weatherEventSchema } from '../../src/types/weather';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const weatherEventPresetSchema = weatherEventSchema;
export const weatherEventPresetsSchema = z.array(weatherEventPresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const weatherEventPresets = weatherEventPresetsSchema.parse([
  // =========================================================================
  // FALLBACK EVENTS (niedrige Spezifität)
  // Matchen wenn nichts Spezifischeres passt
  // =========================================================================
  {
    id: 'cloudy',
    name: 'Bewölkt',
    preconditions: {},  // Matcht immer
    effects: {
      visibilityModifier: 0.9,
      travelSpeedModifier: 1.0,
    },
    description: 'Grauer Himmel mit durchziehenden Wolken.',
    tags: ['fallback'],
  },
  {
    id: 'clear',
    name: 'Klar',
    preconditions: {
      humidity: { max: 40 },
      cloudCover: { max: 0.3 },
    },
    effects: {
      visibilityModifier: 1.0,
      travelSpeedModifier: 1.0,
    },
    description: 'Klarer Himmel, gute Sicht in alle Richtungen.',
    tags: ['clear'],
  },
  {
    id: 'overcast',
    name: 'Bedeckt',
    preconditions: {
      cloudCover: { min: 0.7 },
    },
    effects: {
      visibilityModifier: 0.85,
      travelSpeedModifier: 1.0,
    },
    description: 'Dichte Wolkendecke bedeckt den Himmel.',
    tags: ['overcast'],
  },
  {
    id: 'partly_cloudy',
    name: 'Teilweise bewölkt',
    preconditions: {
      cloudCover: { min: 0.3, max: 0.7 },
    },
    effects: {
      visibilityModifier: 0.95,
      travelSpeedModifier: 1.0,
    },
    description: 'Wolken ziehen über den Himmel, Sonnenstrahlen brechen durch.',
    tags: ['partly_cloudy'],
  },

  // =========================================================================
  // NIEDERSCHLAG - REGEN
  // =========================================================================
  {
    id: 'drizzle',
    name: 'Nieselregen',
    preconditions: {
      humidity: { min: 55, max: 75 },
      temperature: { min: 3 },
      cloudCover: { min: 0.5 },
    },
    effects: {
      visibilityModifier: 0.9,
      travelSpeedModifier: 0.95,
    },
    description: 'Feiner Nieselregen benetzt alles mit einer dünnen Wasserschicht.',
    tags: ['precipitation', 'light', 'rain'],
  },
  {
    id: 'rain',
    name: 'Regen',
    preconditions: {
      humidity: { min: 65 },
      temperature: { min: 3 },
      cloudCover: { min: 0.6 },
      pressure: { max: 0.2 },
    },
    effects: {
      visibilityModifier: 0.75,
      travelSpeedModifier: 0.9,
      perceptionModifier: -2,
    },
    description: 'Stetiger Regen prasselt herab, Pfützen bilden sich.',
    tags: ['precipitation', 'rain'],
  },
  {
    id: 'heavy_rain',
    name: 'Starkregen',
    preconditions: {
      humidity: { min: 80 },
      temperature: { min: 5 },
      pressure: { max: -0.1 },
    },
    effects: {
      visibilityModifier: 0.5,
      travelSpeedModifier: 0.7,
      perceptionModifier: -5,
    },
    description: 'Peitschender Regen reduziert die Sicht drastisch.',
    tags: ['precipitation', 'heavy', 'rain'],
  },

  // =========================================================================
  // NIEDERSCHLAG - SCHNEE
  // =========================================================================
  {
    id: 'light_snow',
    name: 'Leichter Schneefall',
    preconditions: {
      humidity: { min: 50, max: 75 },
      temperature: { max: 2 },
      cloudCover: { min: 0.5 },
    },
    effects: {
      visibilityModifier: 0.85,
      travelSpeedModifier: 0.9,
    },
    description: 'Sanfte Schneeflocken rieseln vom Himmel.',
    tags: ['precipitation', 'light', 'snow', 'cold'],
  },
  {
    id: 'snow',
    name: 'Schneefall',
    preconditions: {
      humidity: { min: 55 },
      temperature: { max: 0 },
      cloudCover: { min: 0.6 },
    },
    effects: {
      visibilityModifier: 0.7,
      travelSpeedModifier: 0.8,
      perceptionModifier: -2,
    },
    description: 'Dichter Schneefall bedeckt alles in Weiß.',
    tags: ['precipitation', 'snow', 'cold'],
  },
  {
    id: 'blizzard',
    name: 'Schneesturm',
    preconditions: {
      humidity: { min: 65 },
      temperature: { max: -5 },
      wind: { min: 50 },
    },
    effects: {
      visibilityModifier: 0.2,
      travelSpeedModifier: 0.3,
      perceptionModifier: -5,
      exhaustionRisk: true,
    },
    description: 'Heulender Wind peitscht Schnee horizontal durch die Luft.',
    tags: ['precipitation', 'snow', 'cold', 'dangerous', 'storm'],
  },

  // =========================================================================
  // NEBEL
  // =========================================================================
  {
    id: 'mist',
    name: 'Dunst',
    preconditions: {
      humidity: { min: 70, max: 85 },
      wind: { max: 20 },
      cloudCover: { min: 0.4 },
    },
    effects: {
      visibilityModifier: 0.7,
      travelSpeedModifier: 0.95,
      perceptionModifier: -1,
    },
    description: 'Leichter Dunst liegt in der Luft.',
    tags: ['fog', 'light'],
  },
  {
    id: 'fog',
    name: 'Nebel',
    preconditions: {
      humidity: { min: 85 },
      wind: { max: 15 },
    },
    effects: {
      visibilityModifier: 0.4,
      travelSpeedModifier: 0.85,
      perceptionModifier: -3,
    },
    description: 'Dichter Nebel umhüllt die Umgebung.',
    tags: ['fog'],
  },
  {
    id: 'dense_fog',
    name: 'Dichter Nebel',
    preconditions: {
      humidity: { min: 95 },
      wind: { max: 10 },
    },
    effects: {
      visibilityModifier: 0.15,
      travelSpeedModifier: 0.7,
      perceptionModifier: -5,
    },
    description: 'Undurchdringlicher Nebel macht Orientierung fast unmöglich.',
    tags: ['fog', 'dangerous'],
  },

  // =========================================================================
  // STÜRME
  // =========================================================================
  {
    id: 'thunderstorm',
    name: 'Gewitter',
    preconditions: {
      humidity: { min: 75 },
      temperature: { min: 15 },
      pressure: { max: -0.25 },
      wind: { min: 30 },
    },
    effects: {
      visibilityModifier: 0.5,
      travelSpeedModifier: 0.6,
      perceptionModifier: -3,
      rangedAttackModifier: -2,
    },
    description: 'Blitze zucken, Donner grollt, Regen prasselt.',
    tags: ['storm', 'dangerous', 'precipitation'],
  },
  {
    id: 'windstorm',
    name: 'Sturm',
    preconditions: {
      wind: { min: 70 },
    },
    effects: {
      visibilityModifier: 0.8,
      travelSpeedModifier: 0.5,
      rangedAttackModifier: -4,
    },
    description: 'Böiger Wind macht das Vorankommen schwer.',
    tags: ['storm', 'wind'],
  },

  // =========================================================================
  // TERRAIN-SPEZIFISCH (hohe Spezifität durch terrains-Array)
  // =========================================================================
  {
    id: 'sandstorm',
    name: 'Sandsturm',
    preconditions: {
      humidity: { max: 25 },
      wind: { min: 45 },
      terrains: ['desert'],
    },
    effects: {
      visibilityModifier: 0.15,
      travelSpeedModifier: 0.4,
      perceptionModifier: -5,
      exhaustionRisk: true,
    },
    description: 'Peitschender Sand macht Atmen und Sehen zur Qual.',
    tags: ['storm', 'dangerous', 'terrain-specific'],
  },

  // =========================================================================
  // TEMPERATUR-EXTREME
  // =========================================================================
  {
    id: 'heatwave',
    name: 'Hitzewelle',
    preconditions: {
      temperature: { min: 38 },
      humidity: { max: 35 },
      wind: { max: 20 },
    },
    effects: {
      visibilityModifier: 0.95,
      travelSpeedModifier: 0.8,
      exhaustionRisk: true,
    },
    description: 'Brütende Hitze lässt die Luft flimmern.',
    tags: ['temperature', 'dangerous', 'hot'],
  },
  {
    id: 'cold_snap',
    name: 'Kälteeinbruch',
    preconditions: {
      temperature: { max: -20 },
      wind: { min: 20 },
    },
    effects: {
      visibilityModifier: 0.9,
      travelSpeedModifier: 0.7,
      exhaustionRisk: true,
    },
    description: 'Beißende Kälte kriecht durch jede Ritze.',
    tags: ['temperature', 'dangerous', 'cold'],
  },

  // =========================================================================
  // SONSTIGE
  // =========================================================================
  {
    id: 'hail',
    name: 'Hagel',
    preconditions: {
      humidity: { min: 70 },
      temperature: { min: 10, max: 25 },
      pressure: { max: -0.2 },
      wind: { min: 25 },
    },
    effects: {
      visibilityModifier: 0.6,
      travelSpeedModifier: 0.7,
      perceptionModifier: -3,
    },
    description: 'Hagelkörner prasseln herab und hinterlassen Beulen.',
    tags: ['precipitation', 'dangerous'],
  },
]);

export default weatherEventPresets;
