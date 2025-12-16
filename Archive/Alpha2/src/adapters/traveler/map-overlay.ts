/**
 * Map Overlay
 *
 * Canvas overlay for route and token rendering.
 *
 * @module adapters/ui/traveler/map-overlay
 */

import type { AxialCoord } from '../../schemas';
import type { TravelState } from '../../services/travel';
import type { TravelerUIState, MapContext } from '../../orchestrators/traveler';
import type { Waypoint, TokenState } from '../../schemas/travel';
import { axialToPixel } from '../../utils/hex';
import { worldToScreen } from '../../utils/render';

/**
 * Canvas-Overlay für Route und Token Rendering.
 */
export class MapOverlay {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private mapContext: MapContext;

    constructor(parent: HTMLElement, mapContext: MapContext) {
        this.mapContext = mapContext;

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'traveler-overlay';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
        `;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;

        parent.appendChild(this.canvas);
        this.resize();
    }

    /** Map-Kontext aktualisieren */
    updateMapContext(context: MapContext): void {
        this.mapContext = context;
    }

    /** Rendert Route, Waypoints und Token */
    render(travel: TravelState, ui: TravelerUIState): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render route path
        this.renderPath(travel.route.path);

        // Render waypoints
        this.renderWaypoints(travel.route.waypoints, ui.draggingWaypoint);

        // Render hover preview
        if (ui.hoverCoord && travel.route.waypoints.length > 0) {
            this.renderHoverPreview(ui.hoverCoord, travel.route.waypoints);
        }

        // Render token (pass path for smooth interpolation)
        this.renderToken(travel.token, travel.animation, travel.route.path);
    }

    private renderPath(path: AxialCoord[]): void {
        if (path.length < 2) return;

        this.ctx.strokeStyle = '#4A90D9';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        this.ctx.beginPath();

        for (let i = 0; i < path.length; i++) {
            const pixel = this.coordToScreen(path[i]);
            if (i === 0) {
                this.ctx.moveTo(pixel.x, pixel.y);
            } else {
                this.ctx.lineTo(pixel.x, pixel.y);
            }
        }

        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    private renderWaypoints(waypoints: Waypoint[], dragging: Waypoint | null): void {
        for (const waypoint of waypoints) {
            if (waypoint.index === 0) continue; // Skip start (token position)

            const pixel = this.coordToScreen(waypoint.coord);
            const isLast = waypoint.index === waypoints.length - 1;
            const isDragging = dragging?.index === waypoint.index;

            // Waypoint marker
            this.ctx.beginPath();
            this.ctx.arc(pixel.x, pixel.y, isLast ? 12 : 8, 0, Math.PI * 2);
            this.ctx.fillStyle = isLast ? '#E74C3C' : '#F39C12';

            if (isDragging) {
                this.ctx.globalAlpha = 0.7;
            }

            this.ctx.fill();
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Index label
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(String(waypoint.index), pixel.x, pixel.y);

            this.ctx.globalAlpha = 1;
        }
    }

    private renderHoverPreview(hoverCoord: AxialCoord, waypoints: Waypoint[]): void {
        // Nur anzeigen wenn nicht auf bestehendem Waypoint
        const isOnWaypoint = waypoints.some(w =>
            w.coord.q === hoverCoord.q && w.coord.r === hoverCoord.r
        );
        if (isOnWaypoint) return;

        const lastWaypoint = waypoints[waypoints.length - 1];
        if (!lastWaypoint) return;

        const lastPixel = this.coordToScreen(lastWaypoint.coord);
        const hoverPixel = this.coordToScreen(hoverCoord);

        // Preview line
        this.ctx.strokeStyle = '#4A90D9';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.5;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(lastPixel.x, lastPixel.y);
        this.ctx.lineTo(hoverPixel.x, hoverPixel.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Preview marker
        this.ctx.beginPath();
        this.ctx.arc(hoverPixel.x, hoverPixel.y, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = '#4A90D9';
        this.ctx.fill();

        this.ctx.globalAlpha = 1;
    }

    private renderToken(
        token: TokenState,
        animation: TravelState['animation'],
        path: AxialCoord[]
    ): void {
        let pixel: { x: number; y: number };

        // Smooth interpolation when traveling
        if (
            animation.status === 'traveling' &&
            path.length > 1 &&
            animation.pathIndex < path.length - 1
        ) {
            // Get current and next hex positions
            const currentHex = path[animation.pathIndex];
            const nextHex = path[animation.pathIndex + 1];
            const currentPixel = this.coordToScreen(currentHex);
            const nextPixel = this.coordToScreen(nextHex);

            // Linear interpolation between hexes
            pixel = {
                x: currentPixel.x + (nextPixel.x - currentPixel.x) * animation.progress,
                y: currentPixel.y + (nextPixel.y - currentPixel.y) * animation.progress,
            };
        } else {
            // Not traveling or at end - use discrete position
            pixel = this.coordToScreen(token.position);
        }

        // Pulsing effect when traveling
        let radius = 15;
        if (animation.status === 'traveling') {
            radius = 15 + Math.sin(Date.now() / 200) * 2;
        }

        // Token circle
        this.ctx.beginPath();
        this.ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = token.color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Token label (first character of name)
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(token.name.charAt(0).toUpperCase(), pixel.x, pixel.y);
    }

    private coordToScreen(coord: AxialCoord): { x: number; y: number } {
        const { hexSize, padding, center, camera } = this.mapContext;

        // Convert to pixel position relative to center
        const relativeCoord = {
            q: coord.q - center.q,
            r: coord.r - center.r,
        };
        const pixel = axialToPixel(relativeCoord, hexSize);

        // Add padding and hex offset
        const worldX = pixel.x + padding;
        const worldY = pixel.y + padding + hexSize;

        // Apply camera transform
        return worldToScreen(worldX, worldY, camera);
    }

    resize(): void {
        const parent = this.canvas.parentElement;
        if (parent) {
            const rect = parent.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }
    }

    destroy(): void {
        this.canvas.remove();
    }
}
