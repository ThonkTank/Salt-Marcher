/**
 * Traveler Presenter
 *
 * State management and event dispatch for travel mode.
 * No DOM access - delegates rendering to adapter.
 *
 * @module presenters/traveler
 */

import type { AxialCoord, CoordKey, ILibraryStore } from '../schemas';
import type { TileData } from '../schemas/map';
import type { CameraState } from '../utils/render';
import type { Waypoint } from '../schemas/travel';
import type { CalendarState, TravelDuration } from '../schemas/calendar';
import type { WeatherState } from '../schemas/weather';
import { TravelControls, type TravelState } from '../services/travel';
import { CameraService } from '../services/camera';
import { CalendarService, type CalendarServiceState } from '../services/calendar-service';
import { EncounterService, type EncounterServiceState } from '../services/encounter-service';
import { WeatherService } from '../services/weather';
import { calculateTravelDuration, travelDurationToHours } from '../utils/travel';
import { getTileAt, getTerrainAt } from '../utils/map';
import { BasePresenter } from './base-presenter';

/** UI-Interaktions-State (vom Presenter verwaltet) */
export type TravelerUIState = {
    /** Waypoint der gerade gezogen wird */
    draggingWaypoint: Waypoint | null;
    /** Hover-Koordinate für Preview */
    hoverCoord: AxialCoord | null;
};

/** Map-Kontext (vom Adapter bereitgestellt) */
export type MapContext = {
    tiles: Map<CoordKey, TileData>;
    coords: AxialCoord[];
    hexSize: number;
    padding: number;
    center: AxialCoord;
    camera: CameraState;
};

/** Render-Daten für Adapter */
export type TravelerRenderData = {
	travel: TravelState;
	ui: TravelerUIState;
	calendar: CalendarServiceState;
	estimatedDuration: TravelDuration | null;
	encounter: EncounterServiceState;
	weather: WeatherState | null;
};

/** Callbacks für View-Events */
export type TravelerCallbacks = {
	onMapClick: (coord: AxialCoord) => void;
	onMapRightClick: (coord: AxialCoord) => void;
	onDragStart: (coord: AxialCoord) => void;
	onDragMove: (coord: AxialCoord) => void;
	onDragEnd: () => void;
	onHover: (coord: AxialCoord | null) => void;
	onPan: (deltaX: number, deltaY: number) => void;
	onZoom: (delta: number, centerX: number, centerY: number) => void;
	onResetCamera: () => void;
	onStartTravel: () => void;
	onPauseTravel: () => void;
	onClearRoute: () => void;
	onAddPartyMember: (name: string, level: number) => void;
	onRemovePartyMember: (index: number) => void;
	onDismissEncounter: () => void;
	onAdvanceHours: (hours: number) => void;
	onRerollWeather: () => void;
};

/**
 * Presenter: Verwaltet State, dispatcht an Service.
 * Kein DOM-Zugriff!
 */
export class TravelerPresenter extends BasePresenter<TravelerRenderData, TravelerCallbacks> {
	private travelControls!: TravelControls;
	private cameraService!: CameraService;
	private calendarService!: CalendarService;
	private encounterService!: EncounterService;
	private weatherService!: WeatherService;
	private uiState: TravelerUIState;
	private mapContext: MapContext;
	private estimatedDuration: TravelDuration | null = null;
	private lastCheckedHour: number = 0;
	private lastAnimationStatus: 'idle' | 'traveling' | 'paused' = 'idle';
	private lastTokenPosition: AxialCoord | null = null;
	private initialPosition: AxialCoord;
	private initialCalendarState?: CalendarState;

	constructor(
		initialPosition: AxialCoord,
		mapContext: MapContext,
		initialCalendarState?: CalendarState
	) {
		super();
		this.initialPosition = initialPosition;
		this.initialCalendarState = initialCalendarState;
		this.mapContext = mapContext;
		this.uiState = {
			draggingWaypoint: null,
			hoverCoord: null,
		};
	}

	// ========================================================================
	// BasePresenter Implementation
	// ========================================================================

	/** Initialize presenter - set up services and subscriptions */
	async initialize(): Promise<void> {
		this.travelControls = new TravelControls(this.initialPosition);
		this.lastTokenPosition = this.initialPosition;

		this.addSubscription(this.travelControls.subscribe((state) => {
			// Detect travel completion (was traveling, now idle)
			if (
				this.lastAnimationStatus === 'traveling' &&
				state.animation.status === 'idle'
			) {
				this.handleTravelComplete();
			}
			this.lastAnimationStatus = state.animation.status;

			// Update weather only when token position changes (not every frame)
			const currentPos = state.token.position;
			if (
				!this.lastTokenPosition ||
				this.lastTokenPosition.q !== currentPos.q ||
				this.lastTokenPosition.r !== currentPos.r
			) {
				this.lastTokenPosition = currentPos;
				this.updateWeather();
			}

			this.updateEstimatedDuration();
			this.updateView(this.getState());
		}));

		this.cameraService = new CameraService(this.mapContext.camera);
		this.subscribeToService(this.cameraService, (camera) => {
			this.mapContext.camera = camera;
			this.updateView(this.getState());
		});

		// Initialize calendar service
		this.calendarService = new CalendarService();
		if (this.initialCalendarState) {
			this.calendarService.fromCalendarState(this.initialCalendarState);
		}
		this.subscribeToService(this.calendarService, () => this.updateView(this.getState()));

		// Initialize encounter service
		this.encounterService = new EncounterService();
		this.subscribeToService(this.encounterService, () => this.updateView(this.getState()));

		// Initialize weather service
		this.weatherService = new WeatherService();
		this.subscribeToService(this.weatherService, () => this.updateView(this.getState()));

		// Update weather when calendar changes
		this.subscribeToService(this.calendarService, () => {
			this.updateWeather();
		});

		// Update weather on initial position
		this.updateWeather();

		// Set up hex enter callback for encounter checks
		this.travelControls.setOnHexEnter((pathIndex) => {
			this.handleHexEnter(pathIndex);
		});

		// Initial render
		this.updateView(this.getState());
	}

	/** Get callbacks for View events */
	getCallbacks(): TravelerCallbacks {
		return {
			onMapClick: (coord) => this.handleMapClick(coord),
			onMapRightClick: (coord) => this.handleMapRightClick(coord),
			onDragStart: (coord) => this.handleDragStart(coord),
			onDragMove: (coord) => this.handleDragMove(coord),
			onDragEnd: () => this.handleDragEnd(),
			onHover: (coord) => this.handleHover(coord),
			onPan: (dx, dy) => this.handlePan(dx, dy),
			onZoom: (delta, cx, cy) => this.handleZoom(delta, cx, cy),
			onResetCamera: () => this.handleResetCamera(),
			onStartTravel: () => this.handleStartTravel(),
			onPauseTravel: () => this.handlePauseTravel(),
			onClearRoute: () => this.handleClearRoute(),
			onAddPartyMember: (name, level) => this.handleAddPartyMember(name, level),
			onRemovePartyMember: (index) => this.handleRemovePartyMember(index),
			onDismissEncounter: () => this.handleDismissEncounter(),
			onAdvanceHours: (hours) => this.handleAdvanceHours(hours),
			onRerollWeather: () => this.handleRerollWeather(),
		};
	}

	/** Get current state (readonly) */
	getState(): Readonly<TravelerRenderData> {
		return {
			travel: this.travelControls.getState(),
			ui: this.uiState,
			calendar: this.calendarService.getState(),
			estimatedDuration: this.estimatedDuration,
			encounter: this.encounterService.getState(),
			weather: this.weatherService.getState(),
		};
	}

    /** Map-Kontext aktualisieren (z.B. bei Camera-Änderung) */
    updateMapContext(context: Partial<MapContext>): void {
        this.mapContext = { ...this.mapContext, ...context };
        this.updateView(this.getState());
    }

    // ========================================================================
    // Event-Handler (vom Adapter aufgerufen)
    // ========================================================================

    /** Links-Klick auf Map */
    handleMapClick(coord: AxialCoord): void {
        // Wenn wir gerade dragging sind, ignorieren
        if (this.uiState.draggingWaypoint) return;

        const state = this.travelControls.getState();
        if (state.route.waypoints.length <= 1) {
            // Erste Zielwahl: Route setzen
            this.travelControls.setDestination(coord);
        } else {
            // Weitere Waypoints hinzufügen
            this.travelControls.addWaypoint(coord);
        }
    }

    /** Rechts-Klick auf Map */
    handleMapRightClick(coord: AxialCoord): void {
        this.travelControls.removeWaypointAt(coord);
    }

    /** Drag Start */
    handleDragStart(coord: AxialCoord): void {
        const waypoint = this.travelControls.getWaypointAt(coord);
        // Nur Waypoints ab Index 1 können gedraggt werden (nicht Start)
        if (waypoint && waypoint.index > 0) {
            this.uiState.draggingWaypoint = waypoint;
            this.updateView(this.getState());
        }
    }

    /** Drag Move */
    handleDragMove(coord: AxialCoord): void {
        if (this.uiState.draggingWaypoint) {
            this.travelControls.moveWaypointTo(
                this.uiState.draggingWaypoint.index,
                coord
            );
            // Update dragging waypoint reference
            this.uiState.draggingWaypoint = {
                ...this.uiState.draggingWaypoint,
                coord,
            };
        }
    }

    /** Drag End */
    handleDragEnd(): void {
        this.uiState.draggingWaypoint = null;
        this.updateView(this.getState());
    }

    /** Hover Update */
    handleHover(coord: AxialCoord | null): void {
        if (this.uiState.hoverCoord?.q !== coord?.q ||
            this.uiState.hoverCoord?.r !== coord?.r) {
            this.uiState.hoverCoord = coord;
            this.updateView(this.getState());
        }
    }

    // ========================================================================
    // Camera Event-Handler (dispatch to CameraService)
    // ========================================================================

    /** Pan-Event von Adapter */
    handlePan(deltaX: number, deltaY: number): void {
        this.cameraService.pan(deltaX, deltaY);
    }

    /** Zoom-Event von Adapter */
    handleZoom(delta: number, centerX: number, centerY: number): void {
        this.cameraService.zoom(delta, centerX, centerY);
    }

    /** Kamera zurücksetzen */
    handleResetCamera(): void {
        this.cameraService.reset();
    }

    /** MapContext abrufen (für Adapter) */
    getMapContext(): MapContext {
        return this.mapContext;
    }

    // ========================================================================
    // Control-Panel Actions
    // ========================================================================

    handleStartTravel(): void {
        const state = this.travelControls.getState();
        if (state.animation.status === 'paused') {
            this.travelControls.resumeTravel();
        } else {
            // Reset hour counter when starting a NEW journey (not resuming)
            this.lastCheckedHour = 0;
            this.travelControls.startTravel();
        }
    }

    handlePauseTravel(): void {
        this.travelControls.pauseTravel();
    }

handleClearRoute(): void {
		this.travelControls.clearRoute();
		this.lastCheckedHour = 0;
	}

	/** Handle travel completion - reset tracking state */
	handleTravelComplete(): void {
		// Calendar is now advanced incrementally during travel in handleHexEnter()
		// Just reset tracking state here
		this.estimatedDuration = null;
		this.lastCheckedHour = 0;
	}

	// ========================================================================
	// Encounter Management
	// ========================================================================

	/** Add a party member */
	handleAddPartyMember(name: string, level: number): void {
		this.encounterService.addPartyMember(name, level);
	}

	/** Remove a party member */
	handleRemovePartyMember(index: number): void {
		this.encounterService.removePartyMember(index);
	}

	/** Dismiss current encounter */
	handleDismissEncounter(): void {
		this.encounterService.dismissEncounter();
	}

	/** Set library store for dynamic creature lookup */
	setLibraryStore(store: ILibraryStore): void {
		this.encounterService.setLibraryStore(store);
	}

	/** Called when token enters a new hex during travel */
	private async handleHexEnter(pathIndex: number): Promise<void> {
		if (!this.estimatedDuration) {
			return;
		}

		// Calculate current hour based on position in route
		const totalHours = travelDurationToHours(this.estimatedDuration);
		const routeLength = this.travelControls.getState().route.path.length;
		const progress = pathIndex / Math.max(1, routeLength - 1);
		const currentHour = Math.floor(progress * totalHours);

		// For each new hour that has passed: advance calendar and check encounters
		while (this.lastCheckedHour < currentHour) {
			this.lastCheckedHour++;
			// Advance calendar incrementally during travel
			this.calendarService.advanceHours(1);
			await this.checkEncounterForHour(this.lastCheckedHour);
		}
	}

	/** Perform encounter check for a specific hour */
	private async checkEncounterForHour(hour: number): Promise<void> {
		const position = this.travelControls.getState().token.position;
		const terrain = getTerrainAt(position, this.mapContext.tiles);

		const result = await this.encounterService.checkForEncounter(terrain, hour);

		if (result.triggered) {
			// Pause travel when encounter triggers
			this.travelControls.pauseTravel();
		}
	}

	// ========================================================================
	// Calendar Access (for persistence)
	// ========================================================================

	/** Get calendar state for persistence */
	getCalendarState(): CalendarState {
		return this.calendarService.toCalendarState();
	}

	// ========================================================================
	// Weather Management
	// ========================================================================

	/** Advance time by hours and update weather */
	handleAdvanceHours(hours: number): void {
		this.calendarService.advanceHours(hours);
		// Weather updates automatically via calendar subscription
	}

	/** Reroll weather (new random values) */
	handleRerollWeather(): void {
		this.weatherService.reroll();
	}

	/** Update weather based on current position and time */
	private updateWeather(): void {
		const position = this.travelControls.getState().token.position;
		const tile = getTileAt(position, this.mapContext.tiles);

		if (tile) {
			const calendarState = this.calendarService.getState();
			this.weatherService.update({
				tileClimate: tile.climate,
				timePeriod: calendarState.timePeriod,
				season: calendarState.season,
			});
		} else {
			this.weatherService.clear();
		}
	}

	// ========================================================================
	// Cleanup
	// ========================================================================

    destroy(): void {
        super.destroy();
        // Destroy all owned services
        this.travelControls?.destroy();
        this.cameraService?.destroy();
        this.calendarService?.destroy();
        this.encounterService?.destroy();
        this.weatherService?.destroy();
    }

// ========================================================================
	// Private
	// ========================================================================

	/** Update estimated duration based on current route and terrain */
	private updateEstimatedDuration(): void {
		const route = this.travelControls.getState().route;
		if (route.path.length > 1) {
			this.estimatedDuration = calculateTravelDuration(
				route,
				this.mapContext.tiles
			);
		} else {
			this.estimatedDuration = null;
		}
	}

}
