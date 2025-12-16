/**
 * Encounter Modal
 *
 * Displays active encounter information in a slide-in panel.
 *
 * @module adapters/traveler/encounter-modal
 */

import type { ActiveEncounter } from '../../schemas/encounter';
import { BORDER_COLOR } from '../../constants/ui-styles';

// ============================================================================
// Types
// ============================================================================

export type EncounterModalCallbacks = {
	onDismiss: () => void;
};

// ============================================================================
// Difficulty Colors
// ============================================================================

const DIFFICULTY_COLORS: Record<string, string> = {
	easy: '#4caf50',
	medium: '#ff9800',
	hard: '#f44336',
	deadly: '#9c27b0',
};

// ============================================================================
// EncounterModal
// ============================================================================

/**
 * Slide-in panel for displaying encounter details.
 */
export class EncounterModal {
	private container: HTMLElement;
	private callbacks: EncounterModalCallbacks;
	private isVisible: boolean = false;

	constructor(parent: HTMLElement, callbacks: EncounterModalCallbacks) {
		this.callbacks = callbacks;

		// Create modal container
		this.container = document.createElement('div');
		this.container.className = 'encounter-modal';
		this.container.style.cssText = `
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			width: 300px;
			background: var(--background-primary, #fff);
			border-left: 2px solid ${BORDER_COLOR};
			z-index: 100;
			padding: 16px;
			overflow-y: auto;
			transform: translateX(100%);
			transition: transform 0.3s ease-in-out;
			box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
		`;

		parent.appendChild(this.container);
	}

	/**
	 * Show the modal with encounter data.
	 */
	show(encounter: ActiveEncounter): void {
		if (!this.isVisible) {
			this.container.style.transform = 'translateX(0)';
			this.isVisible = true;
		}

		this.render(encounter);
	}

	/**
	 * Hide the modal.
	 */
	hide(): void {
		if (this.isVisible) {
			this.container.style.transform = 'translateX(100%)';
			this.isVisible = false;
		}
	}

	/**
	 * Cleanup.
	 */
	destroy(): void {
		this.container.remove();
	}

	// ========================================================================
	// Private
	// ========================================================================

	private render(data: ActiveEncounter): void {
		const { encounter, terrain, hour } = data;
		const difficultyColor = DIFFICULTY_COLORS[encounter.difficulty] ?? '#888';

		// Build creature groups HTML
		const groupsHtml = encounter.groups.map((group) => `
			<div class="encounter-group" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
				<span>${group.count}x ${group.creature.name}</span>
				<span style="color: var(--text-muted, #888);">CR ${group.creature.cr ?? '0'}</span>
			</div>
		`).join('');

		this.container.innerHTML = `
			<div class="encounter-header" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--background-modifier-border, #ddd);">
				<div style="font-size: 1.2em; font-weight: 600; margin-bottom: 4px;">Encounter!</div>
				<div style="display: flex; gap: 8px; align-items: center;">
					<span class="difficulty-badge" style="
						background: ${difficultyColor};
						color: white;
						padding: 2px 8px;
						border-radius: 4px;
						font-size: 0.85em;
						text-transform: capitalize;
					">${encounter.difficulty}</span>
					<span style="color: var(--text-muted, #888); font-size: 0.9em;">
						Stunde ${hour} | ${terrain}
					</span>
				</div>
			</div>

			<div class="encounter-creatures" style="margin-bottom: 16px;">
				<div style="font-size: 0.85em; color: var(--text-muted, #888); margin-bottom: 8px;">Kreaturen</div>
				${groupsHtml}
			</div>

			<div class="encounter-stats" style="margin-bottom: 16px; padding: 12px; background: var(--background-secondary, #f5f5f5); border-radius: 4px;">
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span>Kreaturen:</span>
					<span>${encounter.creatureCount}</span>
				</div>
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span>Basis XP:</span>
					<span>${encounter.totalXp.toLocaleString()}</span>
				</div>
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span>Multiplier:</span>
					<span>x${encounter.multiplier}</span>
				</div>
				<div style="display: flex; justify-content: space-between; font-weight: 600;">
					<span>Adjusted XP:</span>
					<span>${encounter.adjustedXp.toLocaleString()}</span>
				</div>
			</div>

			<button class="encounter-dismiss" style="
				width: 100%;
				padding: 12px;
				background: var(--interactive-accent, #7c3aed);
				color: white;
				border: none;
				border-radius: 4px;
				cursor: pointer;
				font-size: 1em;
			">
				Encounter beenden
			</button>
		`;

		// Event listener for dismiss button
		const dismissBtn = this.container.querySelector('.encounter-dismiss');
		dismissBtn?.addEventListener('click', () => this.callbacks.onDismiss());
	}
}
