// src/workmodes/almanac/view/sidebar-resize-handle.ts
// Resizable sidebar handle for Almanac (Phase 2)
//
// Features:
// - Drag to resize sidebar (240-400px)
// - Double-click to reset to default (300px)
// - Persists width to localStorage
// - Visual feedback on hover/drag

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-sidebar-resize');

export interface SidebarResizeHandleOptions {
	readonly minWidth?: number;
	readonly maxWidth?: number;
	readonly defaultWidth?: number;
	readonly storageKey?: string;
	readonly onResize?: (width: number) => void;
}

export interface SidebarResizeHandleHandle {
	destroy(): void;
	getWidth(): number;
	setWidth(width: number): void;
	reset(): void;
}

const DEFAULT_MIN_WIDTH = 240;
const DEFAULT_MAX_WIDTH = 400;
const DEFAULT_WIDTH = 300;
const STORAGE_KEY = "sm-almanac-sidebar-width";

/**
 * Create resizable sidebar handle
 *
 * Adds a draggable handle to the right edge of the sidebar element.
 * User can drag to resize between min/max bounds.
 * Double-click resets to default width.
 * Width persists to localStorage.
 *
 * Phase 2 Implementation
 */
export function createSidebarResizeHandle(
	sidebarElement: HTMLElement,
	options: SidebarResizeHandleOptions = {}
): SidebarResizeHandleHandle {
	const {
		minWidth = DEFAULT_MIN_WIDTH,
		maxWidth = DEFAULT_MAX_WIDTH,
		defaultWidth = DEFAULT_WIDTH,
		storageKey = STORAGE_KEY,
		onResize,
	} = options;

	let currentWidth = loadWidth(storageKey, defaultWidth, minWidth, maxWidth);
	let isDragging = false;
	let startX = 0;
	let startWidth = 0;

	// Create handle element
	const handle = document.createElement("div");
	handle.className = "sm-almanac-sidebar__resize-handle";
	handle.setAttribute("aria-label", "Resize sidebar");
	handle.setAttribute("role", "separator");
	handle.setAttribute("aria-orientation", "vertical");

	// Apply initial width
	sidebarElement.style.width = `${currentWidth}px`;
	sidebarElement.style.minWidth = `${minWidth}px`;
	sidebarElement.style.maxWidth = `${maxWidth}px`;

	// Append handle to sidebar
	sidebarElement.appendChild(handle);

	logger.info("Created resize handle", {
		currentWidth,
		minWidth,
		maxWidth,
		defaultWidth,
	});

	// Mouse down - start dragging
	function handleMouseDown(e: MouseEvent): void {
		isDragging = true;
		startX = e.clientX;
		startWidth = currentWidth;

		// Prevent text selection during drag
		e.preventDefault();

		// Add dragging class for visual feedback
		handle.classList.add("is-dragging");
		document.body.classList.add("sm-almanac-sidebar-resizing");

		// Add global listeners
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		logger.info("Drag started", { startX, startWidth });
	}

	// Mouse move - resize sidebar
	function handleMouseMove(e: MouseEvent): void {
		if (!isDragging) return;

		const deltaX = e.clientX - startX;
		const newWidth = clamp(startWidth + deltaX, minWidth, maxWidth);

		// Apply new width
		sidebarElement.style.width = `${newWidth}px`;
		currentWidth = newWidth;

		// Notify callback
		onResize?.(newWidth);
	}

	// Mouse up - end dragging
	function handleMouseUp(e: MouseEvent): void {
		if (!isDragging) return;

		isDragging = false;

		// Remove dragging class
		handle.classList.remove("is-dragging");
		document.body.classList.remove("sm-almanac-sidebar-resizing");

		// Remove global listeners
		document.removeEventListener("mousemove", handleMouseMove);
		document.removeEventListener("mouseup", handleMouseUp);

		// Save to localStorage
		saveWidth(storageKey, currentWidth);

		logger.info("Drag ended", { finalWidth: currentWidth });
	}

	// Double-click - reset to default
	function handleDoubleClick(e: MouseEvent): void {
		e.preventDefault();

		currentWidth = defaultWidth;
		sidebarElement.style.width = `${currentWidth}px`;

		// Save to localStorage
		saveWidth(storageKey, currentWidth);

		// Notify callback
		onResize?.(currentWidth);

		logger.info("Reset to default", { defaultWidth });
	}

	// Attach event listeners
	handle.addEventListener("mousedown", handleMouseDown);
	handle.addEventListener("dblclick", handleDoubleClick);

	// Public API
	return {
		destroy(): void {
			// Remove event listeners
			handle.removeEventListener("mousedown", handleMouseDown);
			handle.removeEventListener("dblclick", handleDoubleClick);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);

			// Remove handle element
			handle.remove();

			logger.info("Destroyed");
		},

		getWidth(): number {
			return currentWidth;
		},

		setWidth(width: number): void {
			currentWidth = clamp(width, minWidth, maxWidth);
			sidebarElement.style.width = `${currentWidth}px`;
			saveWidth(storageKey, currentWidth);
			onResize?.(currentWidth);

			logger.info("Width set programmatically", {
				width: currentWidth,
			});
		},

		reset(): void {
			currentWidth = defaultWidth;
			sidebarElement.style.width = `${currentWidth}px`;
			saveWidth(storageKey, currentWidth);
			onResize?.(currentWidth);

			logger.info("Reset to default", { defaultWidth });
		},
	};
}

// Helper functions

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function loadWidth(
	storageKey: string,
	defaultWidth: number,
	minWidth: number,
	maxWidth: number
): number {
	try {
		const stored = localStorage.getItem(storageKey);
		if (!stored) return defaultWidth;

		const parsed = parseInt(stored, 10);
		if (isNaN(parsed)) return defaultWidth;

		// Validate bounds
		return clamp(parsed, minWidth, maxWidth);
	} catch (error) {
		logger.error("Failed to load width from storage", {
			error,
		});
		return defaultWidth;
	}
}

function saveWidth(storageKey: string, width: number): void {
	try {
		localStorage.setItem(storageKey, width.toString());
	} catch (error) {
		logger.error("Failed to save width to storage", {
			error,
		});
	}
}
