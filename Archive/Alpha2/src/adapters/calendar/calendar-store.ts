/**
 * Calendar Store
 *
 * Vault adapter for calendar state persistence.
 *
 * @module adapters/calendar-store
 */

import type { Vault } from 'obsidian';
import type { CalendarState } from '../../schemas/calendar';
import {
	DEFAULT_CALENDAR_ID,
	DEFAULT_START_DATE,
} from '../../utils/calendar';
import { ensureDirectory, saveJsonFile, loadJsonFile } from '../shared/vault-utils';

// ============================================================================
// Constants
// ============================================================================

const CALENDAR_DIR = 'SaltMarcher';
const CALENDAR_FILE_PATH = `${CALENDAR_DIR}/calendar.json`;

// ============================================================================
// CalendarStore
// ============================================================================

export class CalendarStore {
	constructor(private vault: Vault) {}

	/**
	 * Load calendar state from vault.
	 */
	async load(): Promise<CalendarState> {
		const data = await loadJsonFile<CalendarState>(this.vault, CALENDAR_FILE_PATH);
		if (data && this.isValidCalendarState(data)) {
			return data;
		}
		return this.getDefaultState();
	}

	/**
	 * Save calendar state to vault.
	 */
	async save(state: CalendarState): Promise<void> {
		await ensureDirectory(this.vault, CALENDAR_DIR);
		await saveJsonFile(this.vault, CALENDAR_FILE_PATH, state);
	}

	/**
	 * Get default calendar state.
	 */
	private getDefaultState(): CalendarState {
		return {
			currentDate: { ...DEFAULT_START_DATE },
			calendarId: DEFAULT_CALENDAR_ID,
		};
	}

	/**
	 * Validate calendar state structure.
	 */
	private isValidCalendarState(data: unknown): data is CalendarState {
		if (typeof data !== 'object' || data === null) return false;
		const obj = data as Record<string, unknown>;

		if (typeof obj.calendarId !== 'string') return false;
		if (typeof obj.currentDate !== 'object' || obj.currentDate === null)
			return false;

		const date = obj.currentDate as Record<string, unknown>;
		return (
			typeof date.day === 'number' &&
			typeof date.month === 'number' &&
			typeof date.year === 'number'
		);
	}

}
