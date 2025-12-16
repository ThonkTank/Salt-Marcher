/**
 * SVG preview for gradient brush showing concentric rings with falloff opacity
 *
 * Unlike the simple brush circle, this renders multiple concentric rings to visualize
 * the gradient falloff effect. Each ring represents one hex distance from center,
 * with opacity decreasing to show strength falloff.
 *
 * Visual design:
 * - Center hex: Full opacity
 * - Each ring out: Decreasing opacity (shows falloff strength)
 * - Color: Green for "add" mode, Red for "subtract" mode
 * - Smooth follow: Uses RAF + pointermove for fluid tracking
 *
 * @example
 * ```typescript
 * const circle = attachGradientCircle(
 *   { svg, contentG },
 *   { initialRadius: 3, hexRadiusPx: 30 }
 * );
 *
 * // Update preview
 * circle.updateRadius(5);
 * circle.updateMode("subtract");
 *
 * // Lifecycle
 * circle.show();
 * circle.hide();
 * circle.destroy();
 * ```
 */

export interface GradientCircleController {
    /** Update brush radius (creates/removes rings as needed) */
    updateRadius(radius: number): void;

    /** Update mode (changes color: green = add, red = subtract) */
    updateMode(mode: "add" | "subtract"): void;

    /** Show circle preview */
    show(): void;

    /** Hide circle preview */
    hide(): void;

    /** Destroy circle and cleanup */
    destroy(): void;
}

interface Handles {
    svg: SVGSVGElement;
    contentG: SVGGElement;
}

interface Options {
    initialRadius: number;
    hexRadiusPx: number;
}

/**
 * Color schemes for add/subtract modes
 */
const COLORS = {
    add: "rgba(46, 125, 50, {opacity})",      // Green
    subtract: "rgba(198, 40, 40, {opacity})",  // Red
} as const;

/**
 * Attach gradient circle preview to SVG
 *
 * Creates concentric rings showing falloff gradient. Follows mouse pointer
 * smoothly using RAF throttling.
 *
 * @param handles - SVG elements to attach to
 * @param opts - Initial configuration
 * @returns Controller for managing circle
 */
export function attachGradientCircle(
    handles: Handles,
    opts: Options
): GradientCircleController {
    const { svg, contentG } = handles;

    // Hex spacing calculations (pointy-top hexagons)
    const R = opts.hexRadiusPx;
    const vStep = 1.5 * R;                        // Vertical spacing
    const hStep = Math.sqrt(3) * R;               // Horizontal spacing
    const avgStep = (vStep + hStep) / 2;          // Average for symmetric circles

    // Convert hex distance to pixels
    const toPx = (hexDist: number): number => Math.max(0, hexDist) * avgStep;

    // Container group for all rings
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("pointer-events", "none");
    group.style.opacity = "0.7";
    contentG.appendChild(group);

    // State
    let currentRadius = opts.initialRadius;
    let currentMode: "add" | "subtract" = "add";
    let rings: SVGCircleElement[] = [];

    // Re-usable SVGPoint for coordinate conversion
    const svgPt = svg.createSVGPoint();
    let lastEvt: PointerEvent | null = null;
    let raf = 0;

    /**
     * Create rings for current radius
     */
    function createRings(radius: number): void {
        // Clear existing rings
        rings.forEach(r => r.remove());
        rings = [];

        // Create concentric rings from center to radius
        for (let dist = 0; dist <= radius; dist++) {
            const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            ring.setAttribute("cx", "0");
            ring.setAttribute("cy", "0");
            ring.setAttribute("r", String(toPx(dist)));
            ring.setAttribute("fill", "none");
            ring.setAttribute("stroke-width", "2");
            ring.setAttribute("pointer-events", "none");

            // Calculate opacity falloff (center = 1.0, edge = 0.1)
            const opacity = radius === 0 ? 1.0 : 1.0 - (dist / radius) * 0.9;

            // Apply color with opacity
            const color = currentMode === "add" ? COLORS.add : COLORS.subtract;
            ring.setAttribute("stroke", color.replace("{opacity}", opacity.toFixed(2)));

            group.appendChild(ring);
            rings.push(ring);
        }
    }

    /**
     * Update ring colors for current mode
     */
    function updateRingColors(): void {
        const radius = currentRadius;
        rings.forEach((ring, idx) => {
            const dist = idx; // Ring index = distance from center
            const opacity = radius === 0 ? 1.0 : 1.0 - (dist / radius) * 0.9;
            const color = currentMode === "add" ? COLORS.add : COLORS.subtract;
            ring.setAttribute("stroke", color.replace("{opacity}", opacity.toFixed(2)));
        });
    }

    /**
     * Convert screen coordinates to content-space coordinates
     */
    function toContent(): DOMPoint | null {
        const m = contentG.getScreenCTM();
        if (!m) return null;
        return svgPt.matrixTransform(m.inverse());
    }

    /**
     * Bring group to front (above hex polygons)
     */
    function bringToFront(): void {
        contentG.appendChild(group);
    }

    /**
     * RAF tick - update ring positions
     */
    function tick(): void {
        raf = 0;
        if (!lastEvt) return;

        // Convert mouse position to SVG content coordinates
        svgPt.x = lastEvt.clientX;
        svgPt.y = lastEvt.clientY;
        const pt = toContent();
        if (!pt) return;

        // Update all ring positions
        rings.forEach(ring => {
            ring.setAttribute("cx", String(pt.x));
            ring.setAttribute("cy", String(pt.y));
        });

        bringToFront();
    }

    /**
     * Event handlers
     */
    function onPointerMove(ev: PointerEvent): void {
        lastEvt = ev;
        if (!raf) raf = requestAnimationFrame(tick);
    }

    function onPointerEnter(): void {
        group.style.opacity = "0.7";
    }

    function onPointerLeave(): void {
        group.style.opacity = "0";
    }

    // Attach event listeners to SVG (bubbles through polygons)
    svg.addEventListener("pointermove", onPointerMove, { passive: true });
    svg.addEventListener("pointerenter", onPointerEnter, { passive: true });
    svg.addEventListener("pointerleave", onPointerLeave, { passive: true });

    // Create initial rings
    createRings(currentRadius);

    /**
     * Public API
     */
    return {
        updateRadius(radius: number): void {
            currentRadius = radius;
            createRings(radius);
            bringToFront();
        },

        updateMode(mode: "add" | "subtract"): void {
            currentMode = mode;
            updateRingColors();
        },

        show(): void {
            group.style.display = "";
            group.style.opacity = "0.7";
            bringToFront();
        },

        hide(): void {
            group.style.opacity = "0";
        },

        destroy(): void {
            svg.removeEventListener("pointermove", onPointerMove);
            svg.removeEventListener("pointerenter", onPointerEnter);
            svg.removeEventListener("pointerleave", onPointerLeave);
            if (raf) cancelAnimationFrame(raf);
            group.remove();
        }
    };
}
