// src/services/elevation/elevation-field.ts
// Continuous elevation field using sparse control points with interpolation

import { configurableLogger } from "@services/logging/configurable-logger";
import type { ControlPoint, ElevationFieldConfig } from "./elevation-types";

const logger = configurableLogger.forModule("elevation-field");

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ElevationFieldConfig = {
	resolution: 200,
	interpolation: "rbf",
	sigma: 50, // Pixels - controls smoothness (larger = smoother)
	power: 2, // IDW power parameter
};

/**
 * Continuous Elevation Field
 *
 * Stores sparse control points and generates continuous elevation surface via interpolation.
 * Uses two-layer architecture:
 * - **Authoring:** Sparse control points (git-friendly, ~3KB)
 * - **Runtime:** Cached raster grid (ephemeral, 160KB RAM, O(1) lookups)
 *
 * **Features:**
 * - Add/update/remove control points
 * - Automatic cache generation & invalidation
 * - Multiple interpolation methods (RBF, IDW, Bicubic)
 * - Fast O(1) elevation lookups after initial cache generation
 *
 * @example
 * ```typescript
 * const field = new ElevationField({ resolution: 200 });
 *
 * // Add control points
 * field.addControlPoint({ x: 100, y: 100, elevation: 500, type: "painted" });
 * field.addControlPoint({ x: 200, y: 150, elevation: 1200, type: "peak" });
 *
 * // Query elevation at any pixel
 * const elevation = field.getElevation(150, 125);
 * // => ~850m (interpolated)
 * ```
 */
export class ElevationField {
	private controlPoints: Map<string, ControlPoint> = new Map();
	private cache: Float32Array | null = null;
	private cacheChecksum: string | null = null;
	private config: ElevationFieldConfig;

	constructor(config: Partial<ElevationFieldConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		logger.info("Created with config:", this.config);
	}

	/* ---- Control Point Management ---- */

	/**
	 * Add or update a control point
	 *
	 * If a point with the same ID exists, it will be updated.
	 * Otherwise, a new point is created.
	 *
	 * @param point - Control point to add/update
	 */
	addControlPoint(point: Omit<ControlPoint, "id"> & { id?: string }): string {
		const id = point.id || this.generateId();
		const fullPoint: ControlPoint = {
			id,
			x: point.x,
			y: point.y,
			elevation: point.elevation,
			type: point.type,
		};

		this.controlPoints.set(id, fullPoint);
		this.invalidateCache();

		logger.debug(`Added control point ${id} at (${point.x}, ${point.y}) = ${point.elevation}m`);
		return id;
	}

	/**
	 * Update existing control point elevation
	 *
	 * @param id - Control point ID
	 * @param elevation - New elevation value
	 * @returns true if point was updated, false if not found
	 */
	updateElevation(id: string, elevation: number): boolean {
		const point = this.controlPoints.get(id);
		if (!point) {
			logger.warn(`Cannot update - point ${id} not found`);
			return false;
		}

		point.elevation = elevation;
		this.invalidateCache();

		logger.debug(`Updated point ${id} elevation to ${elevation}m`);
		return true;
	}

	/**
	 * Remove a control point
	 *
	 * @param id - Control point ID
	 * @returns true if point was removed, false if not found
	 */
	removeControlPoint(id: string): boolean {
		const removed = this.controlPoints.delete(id);
		if (removed) {
			this.invalidateCache();
			logger.debug(`Removed control point ${id}`);
		}
		return removed;
	}

	/**
	 * Get control point by ID
	 */
	getControlPoint(id: string): ControlPoint | undefined {
		return this.controlPoints.get(id);
	}

	/**
	 * Get all control points
	 */
	getAllControlPoints(): ControlPoint[] {
		return Array.from(this.controlPoints.values());
	}

	/**
	 * Find nearest control point within threshold
	 *
	 * @param x - Pixel X coordinate
	 * @param y - Pixel Y coordinate
	 * @param threshold - Maximum distance in pixels
	 * @returns Nearest control point or undefined
	 */
	findNearestControlPoint(x: number, y: number, threshold: number = 10): ControlPoint | undefined {
		let nearest: ControlPoint | undefined;
		let minDist = threshold;

		for (const point of this.controlPoints.values()) {
			const dist = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
			if (dist < minDist) {
				minDist = dist;
				nearest = point;
			}
		}

		return nearest;
	}

	/**
	 * Clear all control points
	 */
	clear(): void {
		this.controlPoints.clear();
		this.invalidateCache();
		logger.info("Cleared all control points");
	}

	/* ---- Elevation Queries ---- */

	/**
	 * Get elevation at pixel coordinates
	 *
	 * Uses cached grid for fast O(1) lookup. If cache is invalid, regenerates it first.
	 *
	 * @param x - Pixel X coordinate
	 * @param y - Pixel Y coordinate
	 * @returns Elevation in meters, or undefined if outside grid
	 */
	getElevation(x: number, y: number): number | undefined {
		// Ensure cache is valid
		this.ensureCacheValid();

		if (!this.cache) {
			return undefined;
		}

		// Bounds check
		const resolution = this.config.resolution;
		if (x < 0 || x >= resolution || y < 0 || y >= resolution) {
			return undefined;
		}

		// Bilinear interpolation for sub-pixel accuracy
		const x0 = Math.floor(x);
		const x1 = Math.min(x0 + 1, resolution - 1);
		const y0 = Math.floor(y);
		const y1 = Math.min(y0 + 1, resolution - 1);

		const fx = x - x0;
		const fy = y - y0;

		const e00 = this.cache[y0 * resolution + x0];
		const e10 = this.cache[y0 * resolution + x1];
		const e01 = this.cache[y1 * resolution + x0];
		const e11 = this.cache[y1 * resolution + x1];

		// Bilinear interpolation formula
		const elevation = (1 - fx) * (1 - fy) * e00 + fx * (1 - fy) * e10 + (1 - fx) * fy * e01 + fx * fy * e11;

		return elevation;
	}

	/**
	 * Get raw cached elevation grid
	 *
	 * Useful for external processing (contour generation, hillshading, etc.)
	 *
	 * @returns Float32Array of elevation values, or null if no cache
	 */
	getCachedGrid(): Float32Array | null {
		this.ensureCacheValid();
		return this.cache;
	}

	/* ---- Cache Management ---- */

	/**
	 * Ensure cache is valid (regenerates if needed)
	 */
	private ensureCacheValid(): void {
		const currentChecksum = this.calculateChecksum();

		if (!this.cache || this.cacheChecksum !== currentChecksum) {
			logger.info("Cache invalid - regenerating...");
			const startTime = performance.now();

			this.cache = this.generateCache();
			this.cacheChecksum = currentChecksum;

			const elapsed = performance.now() - startTime;
			logger.info(`Cache regenerated in ${elapsed.toFixed(1)}ms`);
		}
	}

	/**
	 * Invalidate cache (forces regeneration on next query)
	 */
	private invalidateCache(): void {
		this.cacheChecksum = null;
	}

	/**
	 * Calculate checksum of current control points
	 */
	private calculateChecksum(): string {
		const points = Array.from(this.controlPoints.values()).sort((a, b) => a.id.localeCompare(b.id));

		return points.map((p) => `${p.x},${p.y},${p.elevation}`).join("|");
	}

	/**
	 * Generate elevation cache grid
	 */
	private generateCache(): Float32Array {
		const resolution = this.config.resolution;
		const grid = new Float32Array(resolution * resolution);

		// If no control points, return zero-filled grid
		if (this.controlPoints.size === 0) {
			return grid;
		}

		const points = Array.from(this.controlPoints.values());

		// Generate grid using selected interpolation method
		for (let y = 0; y < resolution; y++) {
			for (let x = 0; x < resolution; x++) {
				const elevation = this.interpolateAt(x, y, points);
				grid[y * resolution + x] = elevation;
			}
		}

		return grid;
	}

	/**
	 * Interpolate elevation at pixel coordinates using control points
	 */
	private interpolateAt(x: number, y: number, points: ControlPoint[]): number {
		switch (this.config.interpolation) {
			case "rbf":
				return this.interpolateRBF(x, y, points);
			case "idw":
				return this.interpolateIDW(x, y, points);
			case "bicubic":
				// TODO: Implement bicubic interpolation
				logger.warn("Bicubic interpolation not yet implemented, using RBF");
				return this.interpolateRBF(x, y, points);
			default:
				return this.interpolateRBF(x, y, points);
		}
	}

	/**
	 * Radial Basis Function (RBF) interpolation
	 *
	 * Uses Gaussian RBF: φ(r) = exp(-r²/σ²)
	 * Smooth, natural-looking interpolation suitable for terrain.
	 */
	private interpolateRBF(x: number, y: number, points: ControlPoint[]): number {
		const sigma = this.config.sigma || 50;
		const sigmaSq = sigma * sigma;

		let weightSum = 0;
		let valueSum = 0;

		for (const point of points) {
			const dx = x - point.x;
			const dy = y - point.y;
			const distSq = dx * dx + dy * dy;

			// Gaussian RBF kernel
			const weight = Math.exp(-distSq / sigmaSq);

			weightSum += weight;
			valueSum += point.elevation * weight;
		}

		// Avoid division by zero
		if (weightSum < 1e-10) {
			return 0;
		}

		return valueSum / weightSum;
	}

	/**
	 * Inverse Distance Weighting (IDW) interpolation
	 *
	 * Weight = 1 / distance^power
	 * Faster than RBF but can produce sharper transitions.
	 */
	private interpolateIDW(x: number, y: number, points: ControlPoint[]): number {
		const power = this.config.power || 2;

		let weightSum = 0;
		let valueSum = 0;

		for (const point of points) {
			const dx = x - point.x;
			const dy = y - point.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// If very close to a control point, return its value directly
			if (dist < 0.01) {
				return point.elevation;
			}

			const weight = 1 / Math.pow(dist, power);

			weightSum += weight;
			valueSum += point.elevation * weight;
		}

		// Avoid division by zero
		if (weightSum < 1e-10) {
			return 0;
		}

		return valueSum / weightSum;
	}

	/* ---- Serialization ---- */

	/**
	 * Export control points to JSON-serializable format
	 */
	toJSON(): ControlPoint[] {
		return Array.from(this.controlPoints.values());
	}

	/**
	 * Import control points from JSON
	 */
	fromJSON(points: ControlPoint[]): void {
		this.clear();
		for (const point of points) {
			this.controlPoints.set(point.id, point);
		}
		this.invalidateCache();
		logger.info(`Imported ${points.length} control points`);
	}

	/* ---- Utilities ---- */

	/**
	 * Generate unique ID for control point
	 */
	private generateId(): string {
		return `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Get statistics about the elevation field
	 */
	getStats(): {
		controlPoints: number;
		cacheSize: number;
		cacheValid: boolean;
		minElevation?: number;
		maxElevation?: number;
	} {
		const points = Array.from(this.controlPoints.values());
		const elevations = points.map((p) => p.elevation);

		return {
			controlPoints: points.length,
			cacheSize: this.cache ? this.cache.length : 0,
			cacheValid: this.cache !== null && this.cacheChecksum !== null,
			minElevation: elevations.length > 0 ? Math.min(...elevations) : undefined,
			maxElevation: elevations.length > 0 ? Math.max(...elevations) : undefined,
		};
	}
}
