/**
 * Travel Controls Service
 *
 * Business logic for route manipulation and animation.
 * No DOM access - pure state management.
 *
 * @module services/travel/travel-controls
 */

import type { AxialCoord } from '../../schemas';
import type {
	Route,
	TokenState,
	Waypoint,
	TravelState,
	AnimationState,
} from '../../schemas/travel';
import { EMPTY_ROUTE } from '../../schemas/travel';
import {
	buildRoute,
	appendWaypoint,
	removeWaypoint,
	moveWaypoint,
	findWaypointAt,
} from '../../utils/travel';
import { BaseService } from '../base-service';

// Re-export types for backward compatibility
export type { TravelState, AnimationState } from '../../schemas/travel';

/**
 * Service für Route-Manipulation und Animation-Steuerung.
 * Enthält Business-Logik, kein DOM-Zugriff.
 * Extends BaseService for consistent subscription pattern.
 */
export class TravelControls extends BaseService<TravelState> {
    private animationFrame: number | null = null;
    private onHexEnter: ((pathIndex: number) => void) | null = null;

    constructor(
        initialPosition: AxialCoord,
        name = 'Party',
        color = '#FFD700'
    ) {
        super();
        this.state = {
            token: { position: initialPosition, name, color },
            route: buildRoute([initialPosition]),
            animation: { status: 'idle' },
        };
    }

    /** Callback für Hex-Betreten registrieren (für Encounter-Checks) */
    setOnHexEnter(callback: (pathIndex: number) => void): void {
        this.onHexEnter = callback;
    }

    // ========================================================================
    // Route-Manipulation
    // ========================================================================

    /** Setzt Ziel (ersetzt Route) */
    setDestination(coord: AxialCoord): void {
        this.state.route = buildRoute([this.state.token.position, coord]);
        this.state.animation = { status: 'idle' };
        this.notify();
    }

    /** Fügt Waypoint an Ende hinzu */
    addWaypoint(coord: AxialCoord): void {
        this.state.route = appendWaypoint(this.state.route, coord);
        this.notify();
    }

    /** Entfernt Waypoint an Koordinate (außer Start) */
    removeWaypointAt(coord: AxialCoord): boolean {
        const waypoint = findWaypointAt(this.state.route, coord);
        if (waypoint && waypoint.index > 0) {
            this.state.route = removeWaypoint(this.state.route, waypoint.index);
            this.notify();
            return true;
        }
        return false;
    }

    /** Verschiebt Waypoint zu neuer Position */
    moveWaypointTo(index: number, newCoord: AxialCoord): void {
        this.state.route = moveWaypoint(this.state.route, index, newCoord);
        this.notify();
    }

    /** Findet Waypoint an Koordinate */
    getWaypointAt(coord: AxialCoord): Waypoint | null {
        return findWaypointAt(this.state.route, coord);
    }

    /** Setzt Route zurück (nur Token-Position) */
    clearRoute(): void {
        this.stopAnimation();
        this.state.route = buildRoute([this.state.token.position]);
        this.state.animation = { status: 'idle' };
        this.notify();
    }

    // ========================================================================
    // Animation-Steuerung
    // ========================================================================

    /** Startet Animation entlang der Route */
    startTravel(speed = 500): void {
        if (this.state.route.path.length < 2) return;

        this.state.animation = { status: 'traveling', pathIndex: 0, progress: 0 };
        this.animate(speed);
    }

    /** Pausiert Animation */
    pauseTravel(): void {
        if (this.state.animation.status === 'traveling') {
            this.stopAnimation();
            this.state.animation = {
                status: 'paused',
                pathIndex: this.state.animation.pathIndex,
            };
            this.notify();
        }
    }

    /** Setzt Animation fort */
    resumeTravel(speed = 500): void {
        if (this.state.animation.status === 'paused') {
            this.state.animation = {
                status: 'traveling',
                pathIndex: this.state.animation.pathIndex,
                progress: 0,
            };
            this.animate(speed);
        }
    }

    /** Stoppt Animation und setzt Token ans Ziel */
    finishTravel(): void {
        this.stopAnimation();
        if (this.state.route.path.length > 0) {
            const finalPos = this.state.route.path[this.state.route.path.length - 1];
            this.state.token.position = finalPos;
            this.state.route = buildRoute([finalPos]);
        }
        this.state.animation = { status: 'idle' };
        this.notify();
    }

    /** Cleanup */
    destroy(): void {
        this.stopAnimation();
        this.onHexEnter = null;
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    private stopAnimation(): void {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    private animate(speed: number): void {
        let lastTime = performance.now();

        const step = (currentTime: number) => {
            if (this.state.animation.status !== 'traveling') return;

            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            // Progress basiert auf speed (ms pro Hex)
            this.state.animation.progress += deltaTime / speed;

            if (this.state.animation.progress >= 1) {
                this.state.animation.pathIndex++;
                this.state.animation.progress = 0;

                // Update token position to current path hex
                this.state.token.position = this.state.route.path[this.state.animation.pathIndex];

                // Notify about hex enter (for encounter checks) - BEFORE checking finish
                // This ensures the final hex also triggers encounter checks
                this.onHexEnter?.(this.state.animation.pathIndex);

                if (this.state.animation.pathIndex >= this.state.route.path.length - 1) {
                    this.finishTravel();
                    return;
                }
            }

            this.notify();
            this.animationFrame = requestAnimationFrame(step);
        };

        this.animationFrame = requestAnimationFrame(step);
    }
}
