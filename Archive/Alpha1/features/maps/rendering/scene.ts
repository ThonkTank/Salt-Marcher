// src/core/hex-mapper/render/scene.ts
import { coordToKey, axialToCanvasPixel, hexPolygonPoints } from "@geometry";
import { injectIconSymbols, removeIconSymbols } from "./icons/icon-registry";
import {
    renderDistributedSymbols,
    applyHexFillColor
} from "./core/icons";
import type { TerrainType, FloraType, MoistureLevel } from "../../config/terrain";
import type { HexCoord, HexScene, HexSceneConfig, OverlayChannel, OverlayChannelMap } from "../types";

const SVG_NS = "http://www.w3.org/2000/svg";

const keyOf = coordToKey;

type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export function createHexScene(config: HexSceneConfig): HexScene {
    const { host, radius, padding, base, initialCoords, tileStore } = config;

    const hexW = Math.sqrt(3) * radius;
    const hexH = 2 * radius;
    const hStep = hexW;
    const vStep = 0.75 * hexH;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "sm-hex-map-svg");
    svg.setAttribute("width", "100%");
    (svg.style as any).touchAction = "none";

    const overlay = document.createElementNS(SVG_NS, "rect") as SVGRectElement;
    overlay.setAttribute("fill", "transparent");
    overlay.setAttribute("pointer-events", "all");
    (overlay as unknown as HTMLElement).style.touchAction = "none";

    const contentG = document.createElementNS(SVG_NS, "g") as SVGGElement;

    // Icon container groups (separate layers for clean z-ordering)
    const terrainIconG = document.createElementNS(SVG_NS, "g") as SVGGElement;
    terrainIconG.setAttribute("class", "terrain-icon-layer");
    const floraIconG = document.createElementNS(SVG_NS, "g") as SVGGElement;
    floraIconG.setAttribute("class", "flora-icon-layer");
    const moistureIconG = document.createElementNS(SVG_NS, "g") as SVGGElement;
    moistureIconG.setAttribute("class", "moisture-icon-layer");

    svg.appendChild(overlay);
    svg.appendChild(contentG);
    contentG.appendChild(terrainIconG);
    contentG.appendChild(floraIconG);
    contentG.appendChild(moistureIconG);
    host.appendChild(svg);

    // Inject icon symbol definitions into SVG
    injectIconSymbols(svg);

    const polyByCoord = new Map<string, SVGPolygonElement>();

    const internals = {
        bounds: null as Rect | null,
        viewBoxInitialized: false,
        applyFrame(adjustViewBox: boolean) {
            if (!internals.bounds) return;
            const { minX, minY, maxX, maxY } = internals.bounds;
            const paddedMinX = Math.floor(minX - padding);
            const paddedMinY = Math.floor(minY - padding);
            const paddedMaxX = Math.ceil(maxX + padding);
            const paddedMaxY = Math.ceil(maxY + padding);
            const width = Math.max(1, paddedMaxX - paddedMinX);
            const height = Math.max(1, paddedMaxY - paddedMinY);
            if (adjustViewBox || !internals.viewBoxInitialized) {
                svg.setAttribute("viewBox", `${paddedMinX} ${paddedMinY} ${width} ${height}`);
                internals.viewBoxInitialized = true;
            }
            overlay.setAttribute("x", String(paddedMinX));
            overlay.setAttribute("y", String(paddedMinY));
            overlay.setAttribute("width", String(width));
            overlay.setAttribute("height", String(height));
        },
        centerOf(coord: HexCoord) {
            const { x, y } = axialToCanvasPixel(coord, radius, base, padding);
            return { cx: x, cy: y };
        },
        bboxOf(coord: HexCoord) {
            const { cx, cy } = internals.centerOf(coord);
            return {
                minX: cx - hexW / 2,
                maxX: cx + hexW / 2,
                minY: cy - radius,
                maxY: cy + radius,
            };
        },
    };

    function mergeBounds(next: Rect): void {
        if (!internals.bounds) {
            internals.bounds = { ...next };
            return;
        }
        const current = internals.bounds;
        current.minX = Math.min(current.minX, next.minX);
        current.minY = Math.min(current.minY, next.minY);
        current.maxX = Math.max(current.maxX, next.maxX);
        current.maxY = Math.max(current.maxY, next.maxY);
    }

    function addHex(coord: HexCoord): boolean {
        if (polyByCoord.has(keyOf(coord))) return false;
        const { cx, cy } = internals.centerOf(coord);
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", hexPolygonPoints(cx, cy, radius));
        poly.setAttribute("data-q", String(coord.q));
        poly.setAttribute("data-r", String(coord.r));
        (poly.style as any).fill = "transparent";
        (poly.style as any).stroke = "var(--text-muted)";
        (poly.style as any).strokeWidth = "2";
        (poly.style as any).opacity = "0"; // Hide initially to prevent "ghost" tiles during async operations
        // CSS transitions deaktiviert für bessere Performance
        // (poly.style as any).transition = "fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease";
        poly.dataset.defaultStroke = "var(--text-muted)";
        poly.dataset.defaultStrokeWidth = "2";

        // Initialize layer data attributes
        poly.dataset.terrainFill = "transparent";
        poly.dataset.overlayChannels = "{}"; // NEW: Multi-channel support
        poly.dataset.overlayColor = ""; // Keep for backward compatibility
        poly.dataset.markerColor = "";

        // NEW: Icon-based terrain system
        poly.dataset.terrain = "";           // TerrainType ("plains" | "hills" | "mountains")
        poly.dataset.flora = "";             // FloraType ("dense" | "medium" | "field" | "barren")
        poly.dataset.backgroundColor = "";   // Optional hex background color

        contentG.appendChild(poly);
        polyByCoord.set(keyOf(coord), poly);

        // Text-Labels entfernt - sparen 1684 DOM-Nodes und verbessern Performance drastisch
        // Bei Bedarf können Labels on-demand via Inspector angezeigt werden
        // const label = document.createElementNS(SVG_NS, "text");
        // label.setAttribute("x", String(cx));
        // label.setAttribute("y", String(cy + 4));
        // label.setAttribute("text-anchor", "middle");
        // label.setAttribute("pointer-events", "none");
        // label.setAttribute("fill", "var(--text-muted)");
        // label.textContent = `${coord.q},${coord.r}`;
        // contentG.appendChild(label);

        mergeBounds(internals.bboxOf(coord));
        return true;
    }

    function removeHex(coord: HexCoord): boolean {
        const key = keyOf(coord);
        const poly = polyByCoord.get(key);
        if (!poly) return false;

        // Remove icon elements for this hex
        const iconQuery = `[data-q="${coord.q}"][data-r="${coord.r}"]`;
        terrainIconG.querySelectorAll(iconQuery).forEach(el => el.remove());
        floraIconG.querySelectorAll(iconQuery).forEach(el => el.remove());

        // Remove polygon element from DOM
        poly.remove();
        polyByCoord.delete(key);

        return true;
    }

    function ensurePolys(coords: readonly HexCoord[]): void {
        let added = false;
        for (const coord of coords) {
            const key = keyOf(coord);
            if (polyByCoord.has(key)) continue;
            const created = addHex(coord);
            added = added || created;
        }
        if (added) internals.applyFrame(false);
    }

    /**
     * Parses overlay channels from JSON dataset attribute
     */
    function parseOverlayChannels(json: string | undefined): OverlayChannelMap {
        if (!json) return {};
        try {
            const parsed = JSON.parse(json);
            return typeof parsed === "object" && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }

    /**
     * Composites multiple overlay channels into a single visual style
     * Phase 1: Uses top-priority layer only
     * Phase 2 (future): Full alpha compositing
     */
    function compositeOverlays(channels: OverlayChannelMap): {
        finalColor: string;
        finalOpacity: number;
        finalBlendMode: string;
    } {
        const sorted = Object.values(channels).sort((a, b) => a.priority - b.priority);

        if (sorted.length === 0) {
            return { finalColor: "transparent", finalOpacity: 0, finalBlendMode: "" };
        }

        // Phase 1: Use top-priority layer only
        const topLayer = sorted[sorted.length - 1];
        return {
            finalColor: topLayer.color,
            finalOpacity: topLayer.opacity,
            finalBlendMode: topLayer.blendMode ?? "multiply"
        };
    }

    /**
     * Updates the visual appearance of a hex by compositing all layers.
     * Layer priority: Marker > Overlay Composite > Icons > Terrain/Background
     *
     * NEW: Uses multi-symbol distribution system with noise-based color modification
     */
    function updateVisual(coord: HexCoord): void {
        const poly = polyByCoord.get(keyOf(coord));
        if (!poly) return;

        // Read icon-based terrain system data
        const terrain = poly.dataset.terrain as TerrainType | "";
        const flora = poly.dataset.flora as FloraType | "";
        const moisture = poly.dataset.moisture as MoistureLevel | "";
        const backgroundColor = poly.dataset.backgroundColor ?? "";

        const terrainFill = poly.dataset.terrainFill ?? "transparent";
        const markerColor = poly.dataset.markerColor;

        // Clear existing icons for this hex
        const iconQuery = `[data-q="${coord.q}"][data-r="${coord.r}"]`;
        terrainIconG.querySelectorAll(iconQuery).forEach(el => el.remove());
        floraIconG.querySelectorAll(iconQuery).forEach(el => el.remove());
        moistureIconG.querySelectorAll(iconQuery).forEach(el => el.remove());

        // NEW: Apply hex fill color with flora noise modification
        // Apply terrain base color whenever terrain exists (overlays/markers are separate layers on top)
        if (terrain) {
            applyHexFillColor(
                poly,
                coord,
                terrain || undefined,
                flora || undefined
            );
        }

        // NEW: Render distributed symbols (8-12 per hex)
        if (terrain || flora || moisture) {
            const { cx, cy } = internals.centerOf(coord);

            // Get full TileData from store (includes variants), fallback to poly.dataset
            let tileData: import("../../data/tile-repository").TileData;
            if (tileStore) {
                // Get TileData from store (includes terrainVariants/floraVariants/moisture)
                // Using standard store.get() method to access current state
                const snapshot = tileStore.state.get();
                const key = keyOf(coord);
                const record = snapshot.tiles.get(key);
                tileData = record?.data || {
                    terrain: terrain || undefined,
                    flora: flora || undefined,
                    moisture: moisture || undefined
                };
            } else {
                // Fallback: construct minimal TileData from poly.dataset
                tileData = {
                    terrain: terrain || undefined,
                    flora: flora || undefined,
                    moisture: moisture || undefined
                };
            }

            const elements = renderDistributedSymbols(
                coord,
                terrainIconG,
                floraIconG,
                moistureIconG,
                cx,
                cy,
                radius,
                tileData
            );

            // Tag all icons with coordinate for later cleanup
            elements.forEach(el => {
                el.setAttribute("data-q", String(coord.q));
                el.setAttribute("data-r", String(coord.r));
            });
        }

        // NEW: Parse overlay channels
        const overlayChannels = parseOverlayChannels(poly.dataset.overlayChannels);

        // Backward compatibility: If old overlayColor exists, treat it as a faction channel
        const legacyOverlayColor = poly.dataset.overlayColor;
        if (legacyOverlayColor && Object.keys(overlayChannels).length === 0) {
            overlayChannels.faction = {
                type: "faction",
                color: legacyOverlayColor,
                opacity: 0.5,
                priority: 2,
                blendMode: "multiply",
                metadata: {
                    factionId: poly.dataset.factionId,
                    factionName: poly.dataset.factionName
                }
            };
        }

        // Layer priority: Marker > Overlay Composite > Terrain
        if (markerColor) {
            // Marker layer (opacity 1.0)
            (poly.style as any).fill = markerColor;
            (poly.style as any).fillOpacity = "1";
            (poly.style as any).stroke = markerColor;
            (poly.style as any).strokeWidth = "3";
            (poly.style as any).strokeOpacity = "1";
            (poly.style as any).mixBlendMode = "";
        } else if (Object.keys(overlayChannels).length > 0) {
            // NEW: Composite overlay layers
            const composite = compositeOverlays(overlayChannels);
            (poly.style as any).fill = composite.finalColor;
            (poly.style as any).fillOpacity = String(composite.finalOpacity);
            (poly.style as any).stroke = composite.finalColor;
            (poly.style as any).strokeWidth = "3";
            (poly.style as any).strokeOpacity = "0.9";
            (poly.style as any).mixBlendMode = composite.finalBlendMode;
        } else {
            // Terrain layer (legacy terrainFill or new backgroundColor)
            // Priority: backgroundColor > terrainFill
            const fillColor = backgroundColor || terrainFill;
            const fillOpacity = backgroundColor ? "0.15" : (terrainFill !== "transparent" ? "0.25" : "0");

            (poly.style as any).fill = fillColor;
            (poly.style as any).fillOpacity = fillColor !== "transparent" ? fillOpacity : "0";
            (poly.style as any).stroke = poly.dataset.defaultStroke ?? "var(--text-muted)";
            (poly.style as any).strokeWidth = poly.dataset.defaultStrokeWidth ?? "2";
            (poly.style as any).strokeOpacity = "1";
            (poly.style as any).mixBlendMode = "";
        }

        // Reveal polygon after all visual updates complete (prevents "ghost" tiles)
        (poly.style as any).opacity = "1";
    }

    /**
     * Sets the terrain fill color for a hex.
     * This updates the terrain layer independently of overlays.
     */
    function setTerrainFill(coord: HexCoord, color: string): void {
        const poly = polyByCoord.get(keyOf(coord));
        if (!poly) return;

        const fill = color ?? "transparent";
        poly.dataset.terrainFill = fill;
        updateVisual(coord);

        if (fill !== "transparent") {
            poly.setAttribute("data-painted", "1");
        } else {
            poly.removeAttribute("data-painted");
        }
    }

    /**
     * Sets an overlay channel for a hex (Multi-channel support)
     * Internal helper used by setFactionOverlay
     * @param coord - Hex coordinate
     * @param channelType - Channel name (e.g., "faction", "influence", "weather")
     * @param overlay - Overlay data or null to clear
     */
    function setOverlayChannel(
        coord: HexCoord,
        channelType: string,
        overlay: OverlayChannel | null
    ): void {
        const poly = polyByCoord.get(keyOf(coord));
        if (!poly) return;

        const channels = parseOverlayChannels(poly.dataset.overlayChannels);

        if (overlay === null) {
            delete channels[channelType];
        } else {
            channels[channelType] = overlay;
        }

        poly.dataset.overlayChannels = JSON.stringify(channels);
        updateVisual(coord);
    }

    /**
     * Sets the faction overlay for a hex.
     * This updates the overlay layer independently of terrain.
     * Now uses the new multi-channel system internally.
     */
    function setFactionOverlay(
        coord: HexCoord,
        overlay: { color: string; factionId?: string; factionName?: string; fillOpacity?: string; strokeWidth?: string } | null
    ): void {
        if (!overlay) {
            setOverlayChannel(coord, "faction", null);
            return;
        }

        setOverlayChannel(coord, "faction", {
            type: "faction",
            color: overlay.color,
            opacity: parseFloat(overlay.fillOpacity ?? "0.55"),
            priority: 2,
            blendMode: "multiply",
            metadata: {
                factionId: overlay.factionId,
                factionName: overlay.factionName
            }
        });
    }


    /**
     * Sets the terrain icon for a hex (icon-based terrain system)
     * @param coord - Hex coordinate
     * @param terrain - TerrainType or undefined to clear
     */
    function setTerrainIcon(coord: HexCoord, terrain: TerrainType | undefined): void {
        const poly = polyByCoord.get(keyOf(coord));
        if (!poly) return;

        poly.dataset.terrain = terrain ?? "";
        updateVisual(coord);
    }

    /**
     * Sets the flora icon for a hex (icon-based terrain system)
     * @param coord - Hex coordinate
     * @param flora - FloraType or undefined to clear
     */
    function setFloraIcon(coord: HexCoord, flora: FloraType | undefined): void {
        const poly = polyByCoord.get(keyOf(coord));
        if (!poly) return;

        poly.dataset.flora = flora ?? "";
        updateVisual(coord);
    }

    /**
     * Sets the moisture icon for a hex (icon-based moisture system)
     * @param coord - Hex coordinate
     * @param moisture - MoistureLevel or undefined to clear
     */
    function setMoistureIcon(coord: HexCoord, moisture: MoistureLevel | undefined): void {
        const poly = polyByCoord.get(keyOf(coord));
        if (!poly) return;

        poly.dataset.moisture = moisture ?? "";
        updateVisual(coord);
    }

    /**
     * Sets the background color for a hex (optional colored background behind icons)
     * @param coord - Hex coordinate
     * @param color - Hex color string or undefined to clear
     */
    function setBackgroundColor(coord: HexCoord, color: string | undefined): void {
        const poly = polyByCoord.get(keyOf(coord));
        if (!poly) return;

        poly.dataset.backgroundColor = color ?? "";
        updateVisual(coord);
    }

    /**
     * Controls visibility of icon layers (terrain, flora, or moisture)
     * @param layer - 'terrain', 'flora', or 'moisture'
     * @param visible - true to show, false to hide
     */
    function setIconLayerVisibility(layer: 'terrain' | 'flora' | 'moisture', visible: boolean): void {
        const container = layer === 'terrain' ? terrainIconG : layer === 'flora' ? floraIconG : moistureIconG;
        container.style.display = visible ? '' : 'none';
    }

    /**
     * Controls opacity of icon layers (terrain, flora, or moisture)
     * @param layer - 'terrain', 'flora', or 'moisture'
     * @param opacity - 0.0 to 1.0
     */
    function setIconLayerOpacity(layer: 'terrain' | 'flora' | 'moisture', opacity: number): void {
        const container = layer === 'terrain' ? terrainIconG : layer === 'flora' ? floraIconG : moistureIconG;
        container.style.opacity = String(Math.max(0, Math.min(1, opacity)));
    }

    const initial = initialCoords.length ? initialCoords : [];
    if (initial.length) {
        for (const coord of initial) {
            addHex(coord);
            // Make hex visible immediately (even if empty) - fixes invisible empty tiles
            updateVisual(coord);
        }
        internals.applyFrame(true);
    }

    return {
        svg,
        contentG,
        overlay,
        polyByCoord,
        ensurePolys,
        removeHex,
        setTerrainFill,
        setFactionOverlay,
        // Icon-based terrain system methods
        setTerrainIcon,
        setFloraIcon,
        setMoistureIcon,
        setBackgroundColor,
        setIconLayerVisibility,
        setIconLayerOpacity,
        getViewBox: () => {
            if (!internals.bounds) {
                return { minX: 0, minY: 0, width: 0, height: 0 };
            }
            const { minX, minY, maxX, maxY } = internals.bounds;
            return { minX, minY, width: maxX - minX, height: maxY - minY };
        },
        destroy: () => {
            removeIconSymbols(svg);
            polyByCoord.clear();
            svg.remove();
        },
    };
}
