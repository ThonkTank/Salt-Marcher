/**
 * Traveler View
 *
 * Adapter: DOM manipulation, event listeners, canvas rendering.
 * Delegates logic to presenter.
 *
 * @module adapters/ui/traveler/traveler-view
 */

import type { AxialCoord, CalendarState } from '../../schemas';
import {
	TravelerPresenter,
	type TravelerRenderData,
	type MapContext,
} from '../../orchestrators/traveler';
import { renderHexMap } from '../../services/map';
import { hitTestHexFromEvent } from '../../utils/hex/hit-testing';
import { terrainColor } from '../../utils/render';
import { PanState } from '../shared/pan-state';
import { MapOverlay } from './map-overlay';
import { ControlPanel } from './control-panel';
import { EncounterModal } from './encounter-modal';

/**
 * Adapter: DOM-Manipulation, Event-Listener, Canvas-Rendering.
 * Delegiert Logik an Presenter.
 */
export class TravelerView {
    private container: HTMLElement;
    private mapContainer!: HTMLElement; // Assigned in setupDOM()
    private presenter: TravelerPresenter;
    private overlay: MapOverlay;
    private controls: ControlPanel;
    private encounterModal: EncounterModal;
    private mapContext: MapContext;

    // Event handler references for cleanup
    private boundHandleClick: (e: MouseEvent) => void;
    private boundHandleContextMenu: (e: MouseEvent) => void;
    private boundHandleMouseDown: (e: MouseEvent) => void;
    private boundHandleMouseMove: (e: MouseEvent) => void;
    private boundHandleMouseUp: (e: MouseEvent) => void;
    private boundHandleMouseLeave: () => void;
    private boundHandleWheel: (e: WheelEvent) => void;
    private boundHandleResize: () => void;

    // Camera pan state
    private panState = new PanState();

constructor(
		container: HTMLElement,
		mapContext: MapContext,
		initialPosition: AxialCoord,
		initialCalendarState?: CalendarState
	) {
		this.container = container;
		this.mapContext = mapContext;

		// Setup DOM structure
		this.setupDOM();

		// Create presenter (without subscribe yet - subscribe fires immediately)
		this.presenter = new TravelerPresenter(
			initialPosition,
			mapContext,
			initialCalendarState
		);

        // Create overlay and controls BEFORE subscribing
        // (subscribe triggers handleRenderUpdate which needs these)
        this.overlay = new MapOverlay(this.mapContainer, mapContext);
        this.controls = new ControlPanel(this.container, {
            onStart: () => this.presenter.handleStartTravel(),
            onPause: () => this.presenter.handlePauseTravel(),
            onClear: () => this.presenter.handleClearRoute(),
            onAddPartyMember: (name, level) => this.presenter.handleAddPartyMember(name, level),
            onRemovePartyMember: (index) => this.presenter.handleRemovePartyMember(index),
            onRerollWeather: () => this.presenter.handleRerollWeather(),
            onAdvanceHours: (hours) => this.presenter.handleAdvanceHours(hours),
        });

        // Create encounter modal (positioned in map container for overlay effect)
        this.encounterModal = new EncounterModal(this.mapContainer, {
            onDismiss: () => this.presenter.getCallbacks().onDismissEncounter(),
        });

        // Set render callback and initialize presenter
        this.presenter.setOnRender((data: TravelerRenderData) => this.handleRenderUpdate(data));
        this.presenter.initialize();

        // Bind event handlers
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleContextMenu = this.handleContextMenu.bind(this);
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);
        this.boundHandleMouseLeave = this.handleMouseLeave.bind(this);
        this.boundHandleWheel = this.handleWheel.bind(this);
        this.boundHandleResize = this.handleResize.bind(this);

        // Setup event listeners
        this.setupEventListeners();

        // Initial render
        this.renderMap();
    }

    // ========================================================================
    // DOM Setup
    // ========================================================================

    private setupDOM(): void {
        this.container.style.cssText = `
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 100%;
        `;

        // Map container
        this.mapContainer = document.createElement('div');
        this.mapContainer.className = 'traveler-map';
        this.mapContainer.style.cssText = `
            position: relative;
            flex: 1;
            overflow: hidden;
        `;

        this.container.appendChild(this.mapContainer);
    }

    // ========================================================================
    // Event Listeners
    // ========================================================================

    private setupEventListeners(): void {
        this.mapContainer.addEventListener('click', this.boundHandleClick);
        this.mapContainer.addEventListener('contextmenu', this.boundHandleContextMenu);
        this.mapContainer.addEventListener('mousedown', this.boundHandleMouseDown);
        this.mapContainer.addEventListener('mousemove', this.boundHandleMouseMove);
        this.mapContainer.addEventListener('mouseup', this.boundHandleMouseUp);
        this.mapContainer.addEventListener('mouseleave', this.boundHandleMouseLeave);
        this.mapContainer.addEventListener('wheel', this.boundHandleWheel, { passive: false });
        window.addEventListener('resize', this.boundHandleResize);
    }

    private handleClick(e: MouseEvent): void {
        // Ignore if right-click
        if (e.button !== 0) return;

        const coord = this.getHexAtMouse(e);
        if (coord) {
            this.presenter.handleMapClick(coord);
        }
    }

    private handleContextMenu(e: MouseEvent): void {
        e.preventDefault();
        const coord = this.getHexAtMouse(e);
        if (coord) {
            this.presenter.handleMapRightClick(coord);
        }
    }

    private handleMouseDown(e: MouseEvent): void {
        // Middle-mouse for panning
        if (e.button === 1) {
            e.preventDefault();
            this.panState.startPan(e.clientX, e.clientY);
            return;
        }

        // Left-click for drag start
        if (e.button !== 0) return;
        const coord = this.getHexAtMouse(e);
        if (coord) {
            this.presenter.handleDragStart(coord);
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        // Handle panning (middle-mouse)
        const delta = this.panState.updatePan(e.clientX, e.clientY);
        if (delta) {
            this.presenter.handlePan(delta.deltaX, delta.deltaY);
            this.syncMapContextAndRender();
            return;
        }

        const coord = this.getHexAtMouse(e);
        this.presenter.handleHover(coord);

        // If dragging, update position
        if (coord) {
            this.presenter.handleDragMove(coord);
        }
    }

    private handleMouseUp(e: MouseEvent): void {
        if (e.button === 1) {
            this.panState.endPan();
            return;
        }
        this.presenter.handleDragEnd();
    }

    private handleMouseLeave(): void {
        this.panState.endPan();
        this.presenter.handleHover(null);
        this.presenter.handleDragEnd();
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        const rect = this.mapContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = e.deltaY < 0 ? 1 : -1;
        this.presenter.handleZoom(delta, mouseX, mouseY);
        this.syncMapContextAndRender();
    }

    private handleResize(): void {
        this.overlay.resize();
        this.renderMap();
    }

    // ========================================================================
    // Hit Testing
    // ========================================================================

    private getHexAtMouse(e: MouseEvent): AxialCoord | null {
        return hitTestHexFromEvent(e, this.mapContainer, {
            center: this.mapContext.center,
            hexSize: this.mapContext.hexSize,
            padding: this.mapContext.padding,
            camera: this.mapContext.camera,
        }, this.mapContext.tiles);
    }

    // ========================================================================
    // Rendering
    // ========================================================================

private handleRenderUpdate(data: TravelerRenderData): void {
		// Update overlay
		this.overlay.render(data.travel, data.ui);

		// Update control panel with full data including calendar, party and weather
		this.controls.update({
			travel: data.travel,
			calendar: data.calendar,
			estimatedDuration: data.estimatedDuration,
			party: data.encounter.party,
			weather: data.weather,
		});

		// Update encounter modal
		if (data.encounter.activeEncounter) {
			this.encounterModal.show(data.encounter.activeEncounter);
		} else {
			this.encounterModal.hide();
		}
	}

    private syncMapContextAndRender(): void {
        this.mapContext = this.presenter.getMapContext();
        this.overlay.updateMapContext(this.mapContext);
        this.renderMap();
    }

    private renderMap(): void {
        renderHexMap(
            this.mapContainer,
            this.mapContext.tiles,
            this.mapContext.coords,
            {
                center: this.mapContext.center,
                hexSize: this.mapContext.hexSize,
                padding: this.mapContext.padding,
                camera: this.mapContext.camera,
                colorFn: (tile) => terrainColor(tile.terrain),
            }
        );

        // Re-add overlay after map render (since renderHexMap clears container)
        if (!this.mapContainer.contains(this.overlay['canvas'])) {
            this.mapContainer.appendChild(this.overlay['canvas']);
        }
    }

/** Map-Kontext aktualisieren (z.B. bei Camera-Änderung) */
	updateMapContext(context: Partial<MapContext>): void {
		this.mapContext = { ...this.mapContext, ...context };
		this.overlay.updateMapContext(this.mapContext);
		this.presenter.updateMapContext(context);
		this.renderMap();
	}

	/** Get calendar state for persistence */
	getCalendarState(): CalendarState {
		return this.presenter.getCalendarState();
	}

	/** Set library store for dynamic creature lookup in encounters */
	setLibraryStore(store: Parameters<typeof this.presenter.setLibraryStore>[0]): void {
		this.presenter.setLibraryStore(store);
	}

	// ========================================================================
	// Cleanup
	// ========================================================================

    destroy(): void {
        // Remove event listeners
        this.mapContainer.removeEventListener('click', this.boundHandleClick);
        this.mapContainer.removeEventListener('contextmenu', this.boundHandleContextMenu);
        this.mapContainer.removeEventListener('mousedown', this.boundHandleMouseDown);
        this.mapContainer.removeEventListener('mousemove', this.boundHandleMouseMove);
        this.mapContainer.removeEventListener('mouseup', this.boundHandleMouseUp);
        this.mapContainer.removeEventListener('mouseleave', this.boundHandleMouseLeave);
        this.mapContainer.removeEventListener('wheel', this.boundHandleWheel);
        window.removeEventListener('resize', this.boundHandleResize);

        // Cleanup components
        this.overlay.destroy();
        this.controls.destroy();
        this.encounterModal.destroy();
        this.presenter.destroy();

        // Clear container
        this.container.innerHTML = '';
    }
}
