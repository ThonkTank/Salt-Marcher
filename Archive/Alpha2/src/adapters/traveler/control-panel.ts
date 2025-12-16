/**
 * Travel Control Panel
 *
 * UI control panel for travel actions.
 * Uses targeted DOM updates - elements are built once and only textContent is updated.
 *
 * @module adapters/ui/traveler/control-panel
 */

import type { TravelState } from '../../schemas/travel';
import type { CalendarServiceState, TravelDuration } from '../../schemas/calendar';
import type { Party } from '../../schemas/encounter';
import type { WeatherState } from '../../schemas/weather';
import { formatDate, formatTravelDuration } from '../../utils/calendar';
import { TIME_PERIOD_NAMES, SEASON_NAMES } from '../../constants/weather';
import { describeWeatherDetailed } from '../../utils/weather';
import { SECTION_STYLE, LABEL_STYLE, MUTED_TEXT, SECONDARY_BG, BORDER_COLOR } from '../../constants/ui-styles';

export type ControlPanelCallbacks = {
	onStart: () => void;
	onPause: () => void;
	onClear: () => void;
	onAddPartyMember: (name: string, level: number) => void;
	onRemovePartyMember: (index: number) => void;
	onRerollWeather: () => void;
	onAdvanceHours: (hours: number) => void;
};

export type ControlPanelData = {
	travel: TravelState;
	calendar: CalendarServiceState;
	estimatedDuration: TravelDuration | null;
	party: Party;
	weather: WeatherState | null;
};

/**
 * UI Control Panel für Travel-Aktionen.
 * DOM wird einmal gebaut, update() ändert nur textContent.
 */
export class ControlPanel {
	private container: HTMLElement;
	private callbacks: ControlPanelCallbacks;

	// DOM-Referenzen (einmal gebaut, nie zerstört)
	private dateEl!: HTMLElement;
	private weatherSection!: HTMLElement;
	private weatherPeriodEl!: HTMLElement;
	private weatherDescEl!: HTMLElement;
	private hourEl!: HTMLElement;
	private partyListEl!: HTMLElement;
	private partyNameInput!: HTMLInputElement;
	private partyLevelInput!: HTMLInputElement;
	private tokenNameEl!: HTMLElement;
	private positionEl!: HTMLElement;
	private routeDistanceEl!: HTMLElement;
	private durationEl!: HTMLElement;
	private waypointCountEl!: HTMLElement;
	private startBtn!: HTMLButtonElement;
	private pauseBtn!: HTMLButtonElement;
	private clearBtn!: HTMLButtonElement;

	// State tracking for party list updates
	private lastPartyJson: string = '';

	constructor(parent: HTMLElement, callbacks: ControlPanelCallbacks) {
		this.callbacks = callbacks;
		this.container = document.createElement('div');
		this.container.className = 'traveler-controls';
		this.container.style.cssText = `padding: 12px; ${SECONDARY_BG} border-left: 1px solid ${BORDER_COLOR}; min-width: 200px;`;

		this.buildDOM();
		this.attachEventListeners();
		parent.appendChild(this.container);
	}

	/** Aktualisiert Panel - nur textContent, kein DOM-Rebuild */
	update(data: ControlPanelData): void {
		const { travel, calendar, estimatedDuration, party, weather } = data;
		const isTraveling = travel.animation.status === 'traveling';
		const isPaused = travel.animation.status === 'paused';
		const hasRoute = travel.route.waypoints.length > 1;

		// Calendar
		this.dateEl.textContent = formatDate(calendar.currentDate, calendar.config);

		// Weather
		if (weather) {
			this.weatherSection.style.display = '';
			this.weatherPeriodEl.textContent = `Wetter (${TIME_PERIOD_NAMES[weather.timePeriod]}, ${SEASON_NAMES[weather.season]})`;
			this.weatherDescEl.textContent = weather.description;
			this.weatherDescEl.title = describeWeatherDetailed(weather.values);
		} else {
			this.weatherSection.style.display = 'none';
		}

		// Time
		this.hourEl.textContent = `Zeit: ${calendar.currentDate.hour ?? 8}:00 Uhr`;

		// Party list (only rebuild if changed)
		this.updatePartyList(party);

		// Travel info
		this.tokenNameEl.textContent = travel.token.name;
		this.positionEl.textContent = `${travel.token.position.q}, ${travel.token.position.r}`;
		this.routeDistanceEl.textContent = `${travel.route.totalDistance} Hexe`;
		this.durationEl.textContent = estimatedDuration
			? formatTravelDuration(estimatedDuration)
			: '--';
		this.waypointCountEl.textContent = String(travel.route.waypoints.length);

		// Buttons
		this.startBtn.disabled = !hasRoute || isTraveling;
		this.startBtn.textContent = isPaused ? 'Fortsetzen' : 'Reise starten';
		this.pauseBtn.disabled = !isTraveling;
		this.clearBtn.disabled = !hasRoute;
	}

	/** Nur Party-Liste updaten wenn sich Party geändert hat */
	private updatePartyList(party: Party): void {
		const partyJson = JSON.stringify(party);
		if (this.lastPartyJson === partyJson) return;
		this.lastPartyJson = partyJson;

		this.partyListEl.innerHTML = '';

		if (party.length === 0) {
			const emptyEl = document.createElement('div');
			emptyEl.style.cssText = `${MUTED_TEXT} font-size: 0.9em;`;
			emptyEl.textContent = 'Keine Mitglieder';
			this.partyListEl.appendChild(emptyEl);
			return;
		}

		party.forEach((member, index) => {
			const memberEl = document.createElement('div');
			memberEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';

			const nameEl = document.createElement('span');
			nameEl.textContent = `${member.name} (Lvl ${member.level})`;

			const removeBtn = document.createElement('button');
			removeBtn.style.cssText = 'padding: 2px 6px; cursor: pointer; font-size: 0.8em;';
			removeBtn.textContent = 'X';
			removeBtn.addEventListener('click', () => this.callbacks.onRemovePartyMember(index));

			memberEl.appendChild(nameEl);
			memberEl.appendChild(removeBtn);
			this.partyListEl.appendChild(memberEl);
		});
	}

	/** DOM einmal bauen und Referenzen speichern */
	private buildDOM(): void {
		// Calendar Section
		const calendarSection = document.createElement('div');
		calendarSection.style.cssText = SECTION_STYLE;

		const calendarLabel = document.createElement('div');
		calendarLabel.style.cssText = LABEL_STYLE;
		calendarLabel.textContent = 'Aktuelles Datum';

		this.dateEl = document.createElement('div');
		this.dateEl.style.cssText = 'font-weight: 600; font-size: 1.1em;';

		calendarSection.appendChild(calendarLabel);
		calendarSection.appendChild(this.dateEl);

		// Weather Section
		this.weatherSection = document.createElement('div');
		this.weatherSection.style.cssText = SECTION_STYLE;

		this.weatherPeriodEl = document.createElement('div');
		this.weatherPeriodEl.style.cssText = LABEL_STYLE;

		this.weatherDescEl = document.createElement('div');
		this.weatherDescEl.style.cssText = 'font-weight: 600; margin-bottom: 8px;';

		const weatherRerollBtn = document.createElement('button');
		weatherRerollBtn.style.cssText = 'padding: 4px 8px; font-size: 0.85em; cursor: pointer;';
		weatherRerollBtn.textContent = 'Neu wuerfeln';
		weatherRerollBtn.className = 'weather-reroll';

		this.weatherSection.appendChild(this.weatherPeriodEl);
		this.weatherSection.appendChild(this.weatherDescEl);
		this.weatherSection.appendChild(weatherRerollBtn);

		// Time Section
		const timeSection = document.createElement('div');
		timeSection.style.cssText = SECTION_STYLE;

		this.hourEl = document.createElement('div');
		this.hourEl.style.cssText = LABEL_STYLE;

		const timeButtons = document.createElement('div');
		timeButtons.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap;';

		const advance1hBtn = document.createElement('button');
		advance1hBtn.style.cssText = 'padding: 4px 8px; cursor: pointer;';
		advance1hBtn.textContent = '+1h';
		advance1hBtn.className = 'advance-1h';

		const advance4hBtn = document.createElement('button');
		advance4hBtn.style.cssText = 'padding: 4px 8px; cursor: pointer;';
		advance4hBtn.textContent = '+4h';
		advance4hBtn.className = 'advance-4h';

		const advance8hBtn = document.createElement('button');
		advance8hBtn.style.cssText = 'padding: 4px 8px; cursor: pointer;';
		advance8hBtn.textContent = '+8h';
		advance8hBtn.className = 'advance-8h';

		timeButtons.appendChild(advance1hBtn);
		timeButtons.appendChild(advance4hBtn);
		timeButtons.appendChild(advance8hBtn);
		timeSection.appendChild(this.hourEl);
		timeSection.appendChild(timeButtons);

		// Party Section
		const partySection = document.createElement('div');
		partySection.style.cssText = SECTION_STYLE;

		const partyLabel = document.createElement('div');
		partyLabel.style.cssText = LABEL_STYLE + ' margin-bottom: 8px;';
		partyLabel.textContent = 'Party';

		this.partyListEl = document.createElement('div');
		this.partyListEl.style.cssText = 'margin-bottom: 8px;';

		const partyAddRow = document.createElement('div');
		partyAddRow.style.cssText = 'display: flex; gap: 4px;';

		this.partyNameInput = document.createElement('input');
		this.partyNameInput.type = 'text';
		this.partyNameInput.placeholder = 'Name';
		this.partyNameInput.style.cssText = 'flex: 1; padding: 4px 8px; min-width: 0;';

		this.partyLevelInput = document.createElement('input');
		this.partyLevelInput.type = 'number';
		this.partyLevelInput.min = '1';
		this.partyLevelInput.max = '20';
		this.partyLevelInput.value = '1';
		this.partyLevelInput.style.cssText = 'width: 50px; padding: 4px;';

		const partyAddBtn = document.createElement('button');
		partyAddBtn.style.cssText = 'padding: 4px 8px; cursor: pointer;';
		partyAddBtn.textContent = '+';
		partyAddBtn.className = 'party-add-btn';

		partyAddRow.appendChild(this.partyNameInput);
		partyAddRow.appendChild(this.partyLevelInput);
		partyAddRow.appendChild(partyAddBtn);
		partySection.appendChild(partyLabel);
		partySection.appendChild(this.partyListEl);
		partySection.appendChild(partyAddRow);

		// Travel Info Section
		const travelInfo = document.createElement('div');
		travelInfo.style.cssText = 'margin-bottom: 12px;';

		const createInfoRow = (label: string): HTMLElement => {
			const row = document.createElement('div');
			row.style.cssText = 'margin-bottom: 4px;';
			const strong = document.createElement('strong');
			strong.textContent = label;
			row.appendChild(strong);
			const value = document.createElement('span');
			row.appendChild(value);
			return value;
		};

		this.tokenNameEl = createInfoRow('Token: ');
		this.positionEl = createInfoRow('Position: ');
		this.routeDistanceEl = createInfoRow('Route: ');
		this.durationEl = createInfoRow('Reisedauer: ');
		this.waypointCountEl = createInfoRow('Waypoints: ');

		travelInfo.appendChild(this.tokenNameEl.parentElement!);
		travelInfo.appendChild(this.positionEl.parentElement!);
		travelInfo.appendChild(this.routeDistanceEl.parentElement!);
		travelInfo.appendChild(this.durationEl.parentElement!);
		travelInfo.appendChild(this.waypointCountEl.parentElement!);

		// Travel Buttons
		const travelButtons = document.createElement('div');
		travelButtons.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

		this.startBtn = document.createElement('button');
		this.startBtn.style.cssText = 'padding: 8px 12px; cursor: pointer;';
		this.startBtn.className = 'travel-start';

		this.pauseBtn = document.createElement('button');
		this.pauseBtn.style.cssText = 'padding: 8px 12px; cursor: pointer;';
		this.pauseBtn.textContent = 'Pause';
		this.pauseBtn.className = 'travel-pause';

		this.clearBtn = document.createElement('button');
		this.clearBtn.style.cssText = 'padding: 8px 12px; cursor: pointer;';
		this.clearBtn.textContent = 'Route löschen';
		this.clearBtn.className = 'travel-clear';

		travelButtons.appendChild(this.startBtn);
		travelButtons.appendChild(this.pauseBtn);
		travelButtons.appendChild(this.clearBtn);

		// Assemble container
		this.container.appendChild(calendarSection);
		this.container.appendChild(this.weatherSection);
		this.container.appendChild(timeSection);
		this.container.appendChild(partySection);
		this.container.appendChild(travelInfo);
		this.container.appendChild(travelButtons);
	}

	/** Event-Listener einmal anhängen (bleiben für immer) */
	private attachEventListeners(): void {
		// Travel buttons
		this.startBtn.addEventListener('click', () => this.callbacks.onStart());
		this.pauseBtn.addEventListener('click', () => this.callbacks.onPause());
		this.clearBtn.addEventListener('click', () => this.callbacks.onClear());

		// Weather reroll
		const rerollBtn = this.container.querySelector('.weather-reroll');
		rerollBtn?.addEventListener('click', () => this.callbacks.onRerollWeather());

		// Time controls
		const advance1hBtn = this.container.querySelector('.advance-1h');
		const advance4hBtn = this.container.querySelector('.advance-4h');
		const advance8hBtn = this.container.querySelector('.advance-8h');
		advance1hBtn?.addEventListener('click', () => this.callbacks.onAdvanceHours(1));
		advance4hBtn?.addEventListener('click', () => this.callbacks.onAdvanceHours(4));
		advance8hBtn?.addEventListener('click', () => this.callbacks.onAdvanceHours(8));

		// Party add
		const partyAddBtn = this.container.querySelector('.party-add-btn');
		partyAddBtn?.addEventListener('click', () => {
			const name = this.partyNameInput.value.trim();
			const level = parseInt(this.partyLevelInput.value, 10) || 1;
			if (name) {
				this.callbacks.onAddPartyMember(name, level);
				this.partyNameInput.value = '';
				this.partyLevelInput.value = '1';
			}
		});
	}

	destroy(): void {
		this.container.remove();
	}
}
