/**
 * Weather Constants
 *
 * Time periods, season modifiers, and weather descriptions.
 *
 * @module constants/weather
 */

import type { TimePeriod, Season } from '../schemas/weather';
import { CLIMATE_MIN, CLIMATE_SIZE } from './climate';

// ============================================================================
// Time Period Constants
// ============================================================================

/** Time period constants */
export const TIME_PERIOD_CONFIG = {
	HOURS_PER_PERIOD: 4,
	PERIODS_PER_DAY: 6,
	MAX_HOUR: 23,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a 1-12 scale description Record from an array of labels.
 * @param labels - Array of exactly 12 description strings
 * @returns Record mapping 1-12 to the corresponding labels
 */
function createScaleDescriptions(labels: readonly string[]): Record<number, string> {
	if (labels.length !== CLIMATE_SIZE) {
		throw new Error(`Scale descriptions must have exactly ${CLIMATE_SIZE} entries, got ${labels.length}`);
	}
	return Object.fromEntries(labels.map((label, i) => [i + CLIMATE_MIN, label]));
}

// ============================================================================
// Time Periods (6 periods, 4 hours each)
// ============================================================================

/** Time period definitions in order (0-23 hours) */
export const TIME_PERIODS: readonly TimePeriod[] = [
	'night', // 0-3
	'dawn', // 4-7
	'morning', // 8-11
	'midday', // 12-15
	'afternoon', // 16-19
	'evening', // 20-23
] as const;

/** Get time period from hour (0-23) */
export function getTimePeriodFromHour(hour: number): TimePeriod {
	const clampedHour = Math.max(0, Math.min(TIME_PERIOD_CONFIG.MAX_HOUR, hour));
	const periodIndex = Math.floor(clampedHour / TIME_PERIOD_CONFIG.HOURS_PER_PERIOD);
	return TIME_PERIODS[periodIndex] ?? 'night';
}

/** Get hour range for a time period */
export function getHourRangeForPeriod(period: TimePeriod): [number, number] {
	const index = TIME_PERIODS.indexOf(period);
	const startHour = index * TIME_PERIOD_CONFIG.HOURS_PER_PERIOD;
	return [startHour, startHour + TIME_PERIOD_CONFIG.HOURS_PER_PERIOD - 1];
}

// ============================================================================
// Weather Modifiers
// ============================================================================

/** Modifier values for each weather type */
export type WeatherModifiers = {
	temperature: number;
	precipitation: number;
	clouds: number;
	wind: number;
};

/** Time of day modifiers for each weather type */
export const TIME_PERIOD_MODIFIERS: Record<TimePeriod, WeatherModifiers> = {
	night: { temperature: -2, precipitation: 0, clouds: -1, wind: -1 },
	dawn: { temperature: -1, precipitation: 1, clouds: 1, wind: 0 },
	morning: { temperature: 0, precipitation: 0, clouds: 0, wind: 1 },
	midday: { temperature: 2, precipitation: -1, clouds: -1, wind: 1 },
	afternoon: { temperature: 1, precipitation: 0, clouds: 0, wind: 0 },
	evening: { temperature: 0, precipitation: 1, clouds: 1, wind: -1 },
};

/** Season modifiers for each weather type */
export const SEASON_MODIFIERS: Record<Season, WeatherModifiers> = {
	spring: { temperature: 0, precipitation: 1, clouds: 1, wind: 1 },
	summer: { temperature: 2, precipitation: -1, clouds: -1, wind: 0 },
	autumn: { temperature: -1, precipitation: 1, clouds: 1, wind: 2 },
	winter: { temperature: -3, precipitation: 0, clouds: 0, wind: 1 },
};

/** Random variation range by season (added to tile range) */
export const SEASON_VARIATION_RANGE: Record<Season, number> = {
	spring: 2,
	summer: 1,
	autumn: 2,
	winter: 3,
};

/** Default tile variation range */
export const DEFAULT_TILE_VARIATION_RANGE = 1;

// ============================================================================
// Weather Descriptions (German, 1-12 scale)
// ============================================================================

/** Temperature descriptions (1-12 scale) */
export const TEMPERATURE_DESCRIPTIONS = createScaleDescriptions([
	'eisig',
	'frostig',
	'sehr kalt',
	'kalt',
	'kuehl',
	'mild',
	'angenehm',
	'warm',
	'sehr warm',
	'heiss',
	'sehr heiss',
	'gluehend heiss',
]);

/** Precipitation descriptions (1-12 scale) */
export const PRECIPITATION_DESCRIPTIONS = createScaleDescriptions([
	'trocken',
	'trocken',
	'leicht feucht',
	'feucht',
	'leichter Nieselregen',
	'Nieselregen',
	'leichter Regen',
	'Regen',
	'starker Regen',
	'Schauer',
	'Gewitter',
	'Unwetter',
]);

/** Cloud descriptions (1-12 scale) */
export const CLOUD_DESCRIPTIONS = createScaleDescriptions([
	'wolkenlos',
	'klar',
	'leicht bewoelkt',
	'heiter',
	'teilweise bewoelkt',
	'wechselnd bewoelkt',
	'bewoelkt',
	'stark bewoelkt',
	'fast bedeckt',
	'bedeckt',
	'duester',
	'stark bedeckt',
]);

/** Wind descriptions (1-12 scale) */
export const WIND_DESCRIPTIONS = createScaleDescriptions([
	'windstill',
	'leiser Zug',
	'leichte Brise',
	'schwacher Wind',
	'maessiger Wind',
	'frischer Wind',
	'starker Wind',
	'stuermischer Wind',
	'Sturm',
	'schwerer Sturm',
	'orkanartiger Sturm',
	'Orkan',
]);

/** Time period display names (German) */
export const TIME_PERIOD_NAMES: Record<TimePeriod, string> = {
	night: 'Nacht',
	dawn: 'Morgendaemmerung',
	morning: 'Vormittag',
	midday: 'Mittag',
	afternoon: 'Nachmittag',
	evening: 'Abend',
};

/** Season display names (German) */
export const SEASON_NAMES: Record<Season, string> = {
	spring: 'Fruehling',
	summer: 'Sommer',
	autumn: 'Herbst',
	winter: 'Winter',
};
