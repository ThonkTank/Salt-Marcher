/**
 * Undo Service
 *
 * Manages undo/redo history for map editing operations.
 *
 * @module services/map/undo-service
 */

import type { AxialCoord, CoordKey, TileData } from '../../schemas';

/**
 * Entry in the undo/redo stack.
 */
export type UndoEntry = {
	/** Coordinates that were modified */
	affectedCoords: AxialCoord[];
	/** Tiles before the operation (for undo) */
	oldTiles: Map<CoordKey, TileData>;
	/** Tiles after the operation (for redo) */
	newTiles: Map<CoordKey, TileData>;
};

/**
 * Manages undo/redo history stack.
 */
export class UndoService {
	private undoStack: UndoEntry[] = [];
	private redoStack: UndoEntry[] = [];
	private maxSize: number;

	constructor(maxSize = 50) {
		this.maxSize = maxSize;
	}

	/**
	 * Push a new entry onto the undo stack.
	 * Clears the redo stack (new action invalidates redo history).
	 */
	push(entry: UndoEntry): void {
		this.undoStack.push(entry);
		this.redoStack = []; // Clear redo on new action

		// Limit stack size
		if (this.undoStack.length > this.maxSize) {
			this.undoStack.shift();
		}
	}

	/**
	 * Pop the last entry from undo stack and push to redo stack.
	 * Returns the entry to be undone, or null if stack is empty.
	 */
	undo(): UndoEntry | null {
		const entry = this.undoStack.pop();
		if (entry) {
			this.redoStack.push(entry);
		}
		return entry ?? null;
	}

	/**
	 * Pop the last entry from redo stack and push to undo stack.
	 * Returns the entry to be redone, or null if stack is empty.
	 */
	redo(): UndoEntry | null {
		const entry = this.redoStack.pop();
		if (entry) {
			this.undoStack.push(entry);
		}
		return entry ?? null;
	}

	/**
	 * Check if undo is available.
	 */
	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	/**
	 * Check if redo is available.
	 */
	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/**
	 * Clear all history.
	 */
	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
	}

	/**
	 * Get current undo stack size.
	 */
	get undoCount(): number {
		return this.undoStack.length;
	}

	/**
	 * Get current redo stack size.
	 */
	get redoCount(): number {
		return this.redoStack.length;
	}
}
