// src/features/maps/config/colors/debounced-color-setter.ts
// Debounced color updates for UI interactions
//
// Prevents excessive vault writes when user drags color picker.
// Default 300ms delay matches Obsidian's typical debounce timing.

import type { ColorManager } from "./color-manager";

/**
 * Debounced color setter for UI interactions.
 *
 * Delays vault writes when user drags color picker to prevent
 * excessive file I/O operations.
 *
 * @example
 * ```typescript
 * const colorManager = new ColorManager(app);
 * const setter = new DebouncedColorSetter(colorManager, 300);
 *
 * // User drags color picker - multiple calls
 * colorPicker.addEventListener("input", () => {
 *   setter.setColor("region", "Misty Woods", colorPicker.value);
 *   // Only writes to vault after 300ms of no changes
 * });
 *
 * // Cleanup on destroy
 * setter.flush();
 * ```
 */
export class DebouncedColorSetter {
	private timeout: ReturnType<typeof setTimeout> | null = null;
	private delay: number;

	/**
	 * Create debounced color setter.
	 *
	 * @param colorManager - ColorManager instance
	 * @param delay - Debounce delay in milliseconds (default: 300ms)
	 */
	constructor(
		private colorManager: ColorManager,
		delay: number = 300
	) {
		this.delay = delay;
	}

	/**
	 * Set color with debouncing.
	 *
	 * Cancels any pending write and schedules a new one after `delay` ms.
	 * Only the last call in a rapid sequence will trigger a vault write.
	 *
	 * @param entityType - "region" or "faction"
	 * @param entityName - Entity name
	 * @param color - Hex color string (#RRGGBB)
	 * @param onComplete - Optional callback when write completes (success: boolean)
	 */
	setColor(
		entityType: "region" | "faction",
		entityName: string,
		color: string,
		onComplete?: (success: boolean) => void
	): void {
		// Cancel pending write
		if (this.timeout) {
			clearTimeout(this.timeout);
		}

		// Schedule new write
		this.timeout = setTimeout(async () => {
			const success = await this.colorManager.setEntityColor(entityType, entityName, color);
			this.timeout = null;
			onComplete?.(success);
		}, this.delay);
	}

	/**
	 * Cancel any pending write.
	 *
	 * Call this when destroying the component to prevent stale writes.
	 */
	flush(): void {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}
}
