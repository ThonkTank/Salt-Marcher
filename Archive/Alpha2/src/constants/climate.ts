/**
 * Climate Constants
 *
 * Climate scale ranges and creature preferences.
 */

// Climate scale (1-12 for all climate values)
export const CLIMATE_MIN = 1;
export const CLIMATE_MAX = 12;
export const CLIMATE_SIZE = 12;

// Temperature preferences for creatures (ranges on the 1-12 scale)
export const TEMPERATURE_PREFERENCES = [
  "arctic",      // 1-2
  "cold",        // 3-4
  "temperate",   // 5-8
  "warm",        // 9-10
  "hot"          // 11-12
] as const;

// Precipitation preferences for creatures
export const PRECIPITATION_PREFERENCES = [
  "arid",        // 1-2
  "dry",         // 3-4
  "moderate",    // 5-8
  "wet",         // 9-10
  "tropical"     // 11-12
] as const;
