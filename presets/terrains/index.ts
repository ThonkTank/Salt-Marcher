// Terrain-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/types/terrain-definition.md

import { z } from 'zod';
import { terrainDefinitionSchema } from '../../src/types/entities/terrainDefinition';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const terrainPresetSchema = terrainDefinitionSchema;
export const terrainPresetsSchema = z.array(terrainPresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const terrainPresets = terrainPresetsSchema.parse([
  {
    id: 'grassland',
    name: 'Grassland',
    movementCost: 1.0,
    encounterModifier: 1.0,
    nativeCreatures: ['wolf'],
    features: [],
    threatLevel: { min: 0, max: 2 },
    blockerHeight: 0,
    defaultCrBudget: 15,
    weatherRanges: {
      temperature: { min: -5, average: 15, max: 35 },
      humidity: { min: 20, average: 45, max: 75 },
      wind: { min: 5, average: 20, max: 60 },
      pressure: { min: -0.3, average: 0.1, max: 0.5 },
      cloudCover: { min: 0.05, average: 0.35, max: 0.7 },
    },
    displayColor: '#90EE90',
    description: 'Open plains with tall grasses and scattered wildflowers.',
  },
  {
    id: 'forest',
    name: 'Forest',
    movementCost: 1.5,
    blocksMounted: true,
    encounterModifier: 1.2,
    nativeCreatures: ['goblin', 'wolf', 'owlbear'],
    features: [],
    threatLevel: { min: 0.25, max: 4 },
    blockerHeight: 60,
    visibilityRange: 150,
    defaultCrBudget: 15,
    weatherRanges: {
      temperature: { min: 0, average: 15, max: 30 },
      humidity: { min: 40, average: 60, max: 85 },
      wind: { min: 0, average: 10, max: 30 },
      pressure: { min: -0.3, average: 0.1, max: 0.5 },
      cloudCover: { min: 0.2, average: 0.5, max: 0.8 },
    },
    displayColor: '#228B22',
    description: 'Dense woodland with towering trees and thick undergrowth.',
  },
  {
    id: 'hill',
    name: 'Hill',
    movementCost: 1.5,
    encounterModifier: 1.0,
    nativeCreatures: ['goblin', 'wolf'],
    features: [],
    threatLevel: { min: 0.5, max: 3 },
    blockerHeight: 30,
    defaultCrBudget: 15,
    weatherRanges: {
      temperature: { min: -10, average: 10, max: 30 },
      humidity: { min: 25, average: 50, max: 75 },
      wind: { min: 10, average: 30, max: 50 },
      pressure: { min: -0.4, average: 0, max: 0.4 },
      cloudCover: { min: 0.1, average: 0.4, max: 0.7 },
    },
    displayColor: '#9ACD32',
    description: 'Rolling hills with rocky outcrops and sparse vegetation.',
  },
  {
    id: 'mountain',
    name: 'Mountain',
    movementCost: 2.5,
    blocksMounted: true,
    blocksCarriage: true,
    encounterModifier: 0.8,
    nativeCreatures: [],
    features: [],
    threatLevel: { min: 2, max: 8 },
    blockerHeight: 100,
    defaultCrBudget: 30,
    weatherRanges: {
      temperature: { min: -20, average: 0, max: 20 },
      humidity: { min: 30, average: 55, max: 85 },
      wind: { min: 20, average: 50, max: 100 },
      pressure: { min: -0.5, average: -0.2, max: 0.3 },
      cloudCover: { min: 0.1, average: 0.45, max: 0.8 },
    },
    displayColor: '#808080',
    description: 'Steep mountain terrain with narrow passes and sheer cliffs.',
  },
  {
    id: 'swamp',
    name: 'Swamp',
    movementCost: 2.0,
    blocksMounted: true,
    blocksCarriage: true,
    encounterModifier: 1.5,
    nativeCreatures: [],
    features: [],
    threatLevel: { min: 1, max: 6 },
    blockerHeight: 10,
    visibilityRange: 100,
    defaultCrBudget: 30,
    weatherRanges: {
      temperature: { min: 5, average: 20, max: 35 },
      humidity: { min: 60, average: 80, max: 98 },
      wind: { min: 0, average: 10, max: 30 },
      pressure: { min: -0.3, average: 0, max: 0.4 },
      cloudCover: { min: 0.3, average: 0.6, max: 0.9 },
    },
    displayColor: '#556B2F',
    description: 'Murky wetlands with stagnant water and treacherous footing.',
  },
  {
    id: 'desert',
    name: 'Desert',
    movementCost: 1.5,
    encounterModifier: 0.7,
    nativeCreatures: [],
    features: [],
    threatLevel: { min: 0.5, max: 5 },
    blockerHeight: 0,
    defaultCrBudget: 15,
    weatherRanges: {
      temperature: { min: 0, average: 35, max: 50 },
      humidity: { min: 5, average: 15, max: 30 },
      wind: { min: 5, average: 15, max: 80 },
      pressure: { min: -0.2, average: 0.2, max: 0.6 },
      cloudCover: { min: 0, average: 0.15, max: 0.4 },
    },
    displayColor: '#F4A460',
    description: 'Arid wasteland with shifting dunes and scorching heat.',
  },
  {
    id: 'coast',
    name: 'Coast',
    movementCost: 1.0,
    encounterModifier: 0.8,
    nativeCreatures: [],
    features: [],
    threatLevel: { min: 0, max: 3 },
    blockerHeight: 0,
    defaultCrBudget: 10,
    weatherRanges: {
      temperature: { min: 5, average: 18, max: 30 },
      humidity: { min: 50, average: 70, max: 90 },
      wind: { min: 10, average: 30, max: 80 },
      pressure: { min: -0.3, average: 0, max: 0.5 },
      cloudCover: { min: 0.15, average: 0.45, max: 0.75 },
    },
    displayColor: '#4169E1',
    description: 'Sandy beaches and rocky shores along the water\'s edge.',
  },
  {
    id: 'arctic',
    name: 'Arctic',
    movementCost: 2.0,
    encounterModifier: 0.7,
    nativeCreatures: [],
    features: [],
    threatLevel: { min: 1, max: 7 },
    blockerHeight: 0,
    defaultCrBudget: 30,
    weatherRanges: {
      temperature: { min: -40, average: -15, max: 5 },
      humidity: { min: 40, average: 60, max: 80 },
      wind: { min: 10, average: 40, max: 100 },
      pressure: { min: -0.4, average: -0.1, max: 0.4 },
      cloudCover: { min: 0.1, average: 0.4, max: 0.75 },
    },
    displayColor: '#E0FFFF',
    description: 'Frozen tundra with biting winds and endless snow.',
  },
]);

export default terrainPresets;
