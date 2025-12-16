// src/services/elevation/sun-position.ts
// Solar and lunar position calculation for hillshade lighting

/**
 * Calculate sun position (azimuth and altitude) for a given date and time
 *
 * Uses simplified astronomical formulas suitable for game visualizations.
 * Based on NOAA solar position calculations.
 *
 * @param dayOfYear - Day of year (1-365)
 * @param timeOfDay - Time in hours (0-24, fractional allowed)
 * @param latitude - Observer latitude in degrees (default: 45°N, mid-latitude)
 * @returns Azimuth (0-360°, 0=N, 90=E, 180=S, 270=W) and altitude (0-90°, 0=horizon, 90=zenith)
 *
 * @example
 * ```typescript
 * // Summer solstice (day 172), noon (12:00)
 * const { azimuth, altitude } = calculateSunPosition(172, 12.0);
 * // azimuth ≈ 180° (due south at solar noon in Northern Hemisphere)
 * // altitude ≈ 68° (high in sky during summer)
 *
 * // Winter solstice (day 355), noon (12:00)
 * const { azimuth, altitude } = calculateSunPosition(355, 12.0);
 * // altitude ≈ 22° (low in sky during winter)
 * ```
 */
export function calculateSunPosition(
	dayOfYear: number,
	timeOfDay: number,
	latitude: number = 45.0
): { azimuth: number; altitude: number } {
	// Convert degrees to radians
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const toDeg = (rad: number) => (rad * 180) / Math.PI;

	// 1. Calculate solar declination angle
	// Declination varies from -23.44° (winter solstice) to +23.44° (summer solstice)
	// Uses approximation: δ = -23.44° × cos((360/365) × (day + 10))
	const declinationDeg = -23.44 * Math.cos(toRad((360 / 365) * (dayOfYear + 10)));
	const declination = toRad(declinationDeg);

	// 2. Calculate hour angle
	// Hour angle = 0° at solar noon, increases by 15° per hour
	// Negative in morning (sun east), positive in afternoon (sun west)
	const solarNoon = 12.0; // Simplified: assume solar noon = 12:00 local time
	const hourAngleDeg = 15 * (timeOfDay - solarNoon);
	const hourAngle = toRad(hourAngleDeg);

	// 3. Calculate solar altitude (elevation angle above horizon)
	// Formula: sin(altitude) = sin(latitude) × sin(declination) + cos(latitude) × cos(declination) × cos(hour angle)
	const latRad = toRad(latitude);
	const sinAltitude =
		Math.sin(latRad) * Math.sin(declination) +
		Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle);

	const altitudeRad = Math.asin(sinAltitude);
	const altitudeDeg = toDeg(altitudeRad);

	// If sun is below horizon, clamp altitude to 0° (no negative altitudes for hillshade)
	const altitude = Math.max(0, altitudeDeg);

	// 4. Calculate solar azimuth (compass direction)
	// Formula: cos(azimuth) = (sin(declination) - sin(latitude) × sin(altitude)) / (cos(latitude) × cos(altitude))
	// But we need to handle quadrant correctly, so use atan2 instead

	// Alternative azimuth formula using atan2 (handles all quadrants correctly):
	// azimuth = atan2(sin(hour angle), cos(hour angle) × sin(latitude) - tan(declination) × cos(latitude))
	const azimuthRad = Math.atan2(
		Math.sin(hourAngle),
		Math.cos(hourAngle) * Math.sin(latRad) -
			Math.tan(declination) * Math.cos(latRad)
	);

	// Convert azimuth from radians to degrees
	// atan2 returns (-180°, 180°], where 0° = due south
	// We need (0°, 360°] where 0° = due north (for hillshade convention)
	let azimuthDeg = toDeg(azimuthRad);

	// Adjust to (0°, 360°] range with 0° = north
	// atan2 gives 0° = south, so add 180° to rotate to north
	azimuthDeg = (azimuthDeg + 180) % 360;
	if (azimuthDeg < 0) azimuthDeg += 360;

	return {
		azimuth: azimuthDeg,
		altitude: altitude,
	};
}

/**
 * Calculate moon position (azimuth and altitude) for a given date and time
 *
 * Simplified lunar position calculation for game visualizations.
 * The moon orbits Earth with a period of ~29.5 days (synodic month).
 *
 * @param dayOfYear - Day of year (1-365)
 * @param timeOfDay - Time in hours (0-24, fractional allowed)
 * @param latitude - Observer latitude in degrees (default: 45°N)
 * @returns Azimuth (0-360°), altitude (0-90°), and phase (0-1, 0=new, 0.5=full)
 *
 * @example
 * ```typescript
 * // Night time (hour 0:00), check moon position
 * const { azimuth, altitude, phase } = calculateMoonPosition(180, 0.0);
 * // Moon provides nighttime lighting when altitude > 0
 * ```
 */
export function calculateMoonPosition(
	dayOfYear: number,
	timeOfDay: number,
	latitude: number = 45.0
): { azimuth: number; altitude: number; phase: number } {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const toDeg = (rad: number) => (rad * 180) / Math.PI;

	// 1. Calculate lunar phase (0-1, where 0 = new moon, 0.5 = full moon, 1 = new moon again)
	// Simplified: assume 29.5-day synodic month
	const synodicMonth = 29.53; // days
	const lunarAge = dayOfYear % synodicMonth; // Days since new moon
	const phase = lunarAge / synodicMonth;

	// 2. Calculate moon's orbital position
	// Moon's declination varies from -28.5° to +28.5° (more than sun's ±23.44°)
	// Simplified: similar to sun but with different period
	const lunarDeclinationDeg = -28.5 * Math.cos(toRad((360 / synodicMonth) * lunarAge));
	const lunarDeclination = toRad(lunarDeclinationDeg);

	// 3. Calculate hour angle for moon
	// Moon rises ~50 minutes later each day due to orbital motion
	// Simplified: offset moon's "noon" by phase (full moon peaks at midnight)
	const lunarNoon = 12.0 + (phase * 24); // Full moon peaks ~24h offset from sun
	const hourAngleDeg = 15 * (timeOfDay - lunarNoon);
	const hourAngle = toRad(hourAngleDeg);

	// 4. Calculate lunar altitude (same formula as sun)
	const latRad = toRad(latitude);
	const sinAltitude =
		Math.sin(latRad) * Math.sin(lunarDeclination) +
		Math.cos(latRad) * Math.cos(lunarDeclination) * Math.cos(hourAngle);

	const altitudeRad = Math.asin(sinAltitude);
	const altitudeDeg = toDeg(altitudeRad);
	const altitude = Math.max(0, altitudeDeg);

	// 5. Calculate lunar azimuth (same formula as sun)
	const azimuthRad = Math.atan2(
		Math.sin(hourAngle),
		Math.cos(hourAngle) * Math.sin(latRad) -
			Math.tan(lunarDeclination) * Math.cos(latRad)
	);

	let azimuthDeg = toDeg(azimuthRad);
	azimuthDeg = (azimuthDeg + 180) % 360;
	if (azimuthDeg < 0) azimuthDeg += 360;

	return {
		azimuth: azimuthDeg,
		altitude: altitude,
		phase: phase,
	};
}

/**
 * Calculate moon illumination factor based on phase
 *
 * Returns a factor (0-1) representing moon brightness:
 * - 0.0 at new moon (not visible)
 * - 1.0 at full moon (maximum brightness)
 * - Gradual transition in between
 *
 * @param phase - Moon phase (0-1, 0=new, 0.5=full)
 * @returns Illumination factor (0-1)
 */
export function getMoonIllumination(phase: number): number {
	// Convert phase (0-1) to illumination
	// Full moon (phase ~0.5) = 1.0 illumination
	// New moon (phase ~0 or ~1) = 0.0 illumination
	const normalizedPhase = Math.abs(phase - 0.5) * 2; // 0 at full, 1 at new
	return 1 - normalizedPhase;
}

/**
 * Get recommended hillshade settings based on time of day
 *
 * Provides sensible defaults for different times of day:
 * - Morning: Low altitude, easterly azimuth (sun)
 * - Noon: High altitude, southerly azimuth (sun)
 * - Evening: Low altitude, westerly azimuth (sun)
 * - Night: Moon lighting if moon is visible
 *
 * @param dayOfYear - Day of year (1-365)
 * @param timeOfDay - Time in hours (0-24)
 * @param latitude - Observer latitude in degrees
 * @returns Recommended hillshade config with intensity factor (0-1)
 */
export function getHillshadeConfig(
	dayOfYear: number,
	timeOfDay: number,
	latitude: number = 45.0
): { azimuth: number; altitude: number; intensity: number } | null {
	const sunPosition = calculateSunPosition(dayOfYear, timeOfDay, latitude);

	// Daytime: use sun
	if (sunPosition.altitude > 0) {
		return {
			azimuth: sunPosition.azimuth,
			altitude: sunPosition.altitude,
			intensity: 1.0, // Full sun intensity
		};
	}

	// Nighttime: try moon
	const moonPosition = calculateMoonPosition(dayOfYear, timeOfDay, latitude);
	if (moonPosition.altitude > 0) {
		const moonBrightness = getMoonIllumination(moonPosition.phase);
		// Moon provides 20-30% of sun's lighting at full illumination
		const intensity = moonBrightness * 0.25;

		return {
			azimuth: moonPosition.azimuth,
			altitude: moonPosition.altitude,
			intensity: intensity,
		};
	}

	// No celestial lighting available (sun and moon both below horizon)
	return null;
}
