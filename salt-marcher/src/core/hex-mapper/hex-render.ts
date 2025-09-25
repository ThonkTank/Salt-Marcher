// src/core/hex-mapper/hex-render.ts
import { App, TFile } from "obsidian";
import { getCenterLeaf } from "../layout";
import { hexPolygonPoints } from "./hex-geom";
import { listTilesForMap, saveTile, type TileCoord } from "./hex-notes";
import type { HexOptions } from "../options";
import { attachCameraControls } from "./camera";
import { TERRAIN_COLORS } from "../terrain";

export type RenderHandles = {
    svg: SVGSVGElement;
    contentG: SVGGElement;
    overlay: SVGRectElement;
    polyByCoord: Map<string, SVGPolygonElement>; // key: "r,c"
    setFill(coord: { r: number; c: number }, color: string): void;
    /** Fügt fehlende Polygone für die angegebenen Koordinaten hinzu und erweitert bei Bedarf die viewBox/overlay. */
    ensurePolys(coords: Array<{ r: number; c: number }>): void;
    destroy(): void;
};

const keyOf = (r: number, c: number) => `${r},${c}`;

type Bounds = { minR: number; maxR: number; minC: number; maxC: number };

function computeBounds(tiles: Array<{ coord: { r: number; c: number } }>): Bounds | null {
    if (!tiles.length) return null;
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const t of tiles) {
        const { r, c } = t.coord;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
    }
    return { minR, maxR, minC, maxC };
}

export async function renderHexMap(
    app: App,
    host: HTMLElement,
    opts: HexOptions,
    mapPath: string
): Promise<RenderHandles> {
    const R = opts.radius;
    const hexW = Math.sqrt(3) * R;
    const hexH = 2 * R;
    const hStep = hexW;
    const vStep = 0.75 * hexH;
    const pad = 12;

    // Tiles laden → dynamische Bounds
    const mapFile = app.vault.getAbstractFileByPath(mapPath);
    let tiles: Array<{ coord: TileCoord; data: { terrain: string } }> = [];
    let bounds: Bounds | null = null;
    if (mapFile instanceof TFile) {
        try {
            tiles = await listTilesForMap(app, mapFile);
            bounds = computeBounds(tiles);
        } catch {
            // still fine; fallback unten
        }
    }

    // Fallback 3×3 um (0..2, 0..2)
    const minR0 = bounds ? bounds.minR : 0;
    const maxR0 = bounds ? bounds.maxR : 2;
    const minC0 = bounds ? bounds.minC : 0;
    const maxC0 = bounds ? bounds.maxC : 2;

    // Basis-Anchor (verschiebt sich NICHT bei späterer Erweiterung -> wir erweitern viewBox stattdessen)
    const baseR = minR0;
    const baseC = minC0;

    // initiale Fläche
    const rows0 = maxR0 - minR0 + 1;
    const cols0 = maxC0 - minC0 + 1;

    // etwas extra Breite wegen odd-r Offset (½ Hex)
    const initW = pad * 2 + hexW * cols0 + hexW * 0.5;
    const initH = pad * 2 + hexH + vStep * (rows0 - 1);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg") as SVGSVGElement;
    svg.setAttribute("class", "hex3x3-map");
    svg.setAttribute("viewBox", `0 0 ${initW} ${initH}`);
    svg.setAttribute("width", "100%");
    (svg.style as any).touchAction = "none";

    // Overlay fängt Pointer-Events ab (Pan/Zoom/Brush-Follow)
    const overlay = document.createElementNS(svgNS, "rect") as SVGRectElement;
    overlay.setAttribute("x", "0");
    overlay.setAttribute("y", "0");
    overlay.setAttribute("width", String(initW));
    overlay.setAttribute("height", String(initH));
    overlay.setAttribute("fill", "transparent");
    overlay.setAttribute("pointer-events", "all");
    (overlay as unknown as HTMLElement).style.touchAction = "none";

    const contentG = document.createElementNS(svgNS, "g") as SVGGElement;

    svg.appendChild(overlay);
    svg.appendChild(contentG);
    host.appendChild(svg);

    // Kamera
    attachCameraControls(
        svg,
        contentG,
        { minScale: 0.15, maxScale: 16, zoomSpeed: 1.01 },
        [overlay, host]
    );

    // ---- Rendering-State
    const polyByCoord = new Map<string, SVGPolygonElement>();
    // aktuelle viewBox (wird bei Erweiterung angepasst)
    let vb = { minX: 0, minY: 0, width: initW, height: initH };

    // Grid → Pixel-Zentrum
    const centerOf = (r: number, c: number) => {
        const cx = pad + (c - baseC) * hStep + (r % 2 ? hexW / 2 : 0);
        const cy = pad + (r - baseR) * vStep + hexH / 2;
        return { cx, cy };
    };
    // Bounding-Box eines Hex (rechteckig, ausreichend für viewBox-Erweiterungen)
    const bboxOf = (r: number, c: number) => {
        const { cx, cy } = centerOf(r, c);
        return {
            minX: cx - hexW / 2,
            maxX: cx + hexW / 2,
            minY: cy - R,
            maxY: cy + R,
        };
    };

    const setViewBox = (minX: number, minY: number, width: number, height: number) => {
        vb = { minX, minY, width, height };
        svg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
        overlay.setAttribute("x", String(minX));
        overlay.setAttribute("y", String(minY));
        overlay.setAttribute("width", String(width));
        overlay.setAttribute("height", String(height));
    };

    // --- Screen→contentG→Hex (nur einmal definieren) -----------------------
    const svgPt = svg.createSVGPoint();

    function toContentPoint(ev: MouseEvent | PointerEvent) {
        const m = contentG.getScreenCTM();
        if (!m) return null;
        svgPt.x = ev.clientX; svgPt.y = ev.clientY;
        return svgPt.matrixTransform(m.inverse());
    }

    function pointToCoord(px: number, py: number): { r: number; c: number } {
        const rFloat = (py - pad - hexH / 2) / vStep + baseR;
        let r = Math.round(rFloat);
        const isOdd = r % 2 !== 0;
        let c = Math.round((px - pad - (isOdd ? hexW / 2 : 0)) / hStep + baseC);

        let best = { r, c }, bestD2 = Infinity;
        for (let dr = -1; dr <= 1; dr++) {
            const rr = r + dr;
            const odd = rr % 2 !== 0;
            const cc = Math.round((px - pad - (odd ? hexW / 2 : 0)) / hStep + baseC);
            const { cx, cy } = centerOf(rr, cc);
            const dx = px - cx, dy = py - cy, d2 = dx*dx + dy*dy;
            if (d2 < bestD2) { bestD2 = d2; best = { r: rr, c: cc }; }
        }
        return best;
    }

    function dispatchHexClick(r: number, c: number): boolean {
        const evt: CustomEvent<{ r:number; c:number }> = new CustomEvent("hex:click", {
            detail: { r, c }, bubbles: true, cancelable: true
        }) as CustomEvent<{ r:number; c:number }>;
        return host.dispatchEvent(evt);
    }

    // Live-Fill
    const setFill = (coord: { r: number; c: number }, color: string) => {
        const poly = polyByCoord.get(keyOf(coord.r, coord.c));
        if (!poly) return;

        const c = color ?? "transparent";

        // Inline-Styles schlagen die CSS-Default-Regeln
        (poly.style as any).fill = c;
        (poly.style as any).fillOpacity = c !== "transparent" ? "0.25" : "0";

        // Für CSS-Selektor :not([data-painted="1"])
        if (c !== "transparent") {
            poly.setAttribute("data-painted", "1");
        } else {
            poly.removeAttribute("data-painted");
        }
    };


    // Polygon + Label + Click anlegen (falls nicht vorhanden)
    const addHex = (r: number, c: number) => {
        const k = keyOf(r, c);
        if (polyByCoord.has(k)) return;

        const { cx, cy } = centerOf(r, c);

        const poly = document.createElementNS(svgNS, "polygon");
        // Attribute korrekt setzen
        poly.setAttribute("points", hexPolygonPoints(cx, cy, R));
        poly.setAttribute("data-row", String(r));
        poly.setAttribute("data-col", String(c));

        // Sichtbarkeit unabhängig von CSS sicherstellen
        (poly.style as any).fill = "transparent";
        (poly.style as any).stroke = "var(--text-muted)";
        (poly.style as any).strokeWidth = "2";
        (poly.style as any).transition = "fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease";

        contentG.appendChild(poly);
        polyByCoord.set(k, poly);

        const label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", String(cx));
        label.setAttribute("y", String(cy + 4));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("pointer-events", "none");
        label.setAttribute("fill", "var(--text-muted)");
        label.textContent = `${r},${c}`;
        contentG.appendChild(label);
    };

    // Initial render: nur echte Tiles (plus 3×3-Fallback für leere Karten)
    if (!tiles.length) {
        const fallback: Array<{ r: number; c: number }> = [];
        for (let r = 0; r <= 2; r++) for (let c = 0; c <= 2; c++) fallback.push({ r, c });
        for (const { r, c } of fallback) addHex(r, c);
    } else {
        const coords = tiles.map(t => t.coord);
        for (const { r, c } of coords) addHex(r, c);
    }

    // vorhandene Tiles einfärben
    for (const { coord, data } of tiles) {
        const color = TERRAIN_COLORS[data.terrain] ?? "transparent";
        setFill(coord, color);
    }

    // --- öffentliche API
    // --- öffentliche API
    const ensurePolys = (coords: Array<{ r: number; c: number }>) => {
        const missing: Array<{ r: number; c: number }> = [];
        for (const { r, c } of coords) if (!polyByCoord.has(`${r},${c}`)) missing.push({ r, c });
        if (!missing.length) return;
        for (const { r, c } of missing) addHex(r, c);
    };

    /* NEU: zentraler SVG-Click → immer Koordinaten berechnen */
    svg.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const pt = toContentPoint(ev as MouseEvent);
        if (!pt) return;
        const { r, c } = pointToCoord(pt.x, pt.y);

        // Editor/Tool übernimmt?
        if (dispatchHexClick(r, c) === false) return;

        // Default-Open (Viewer)
        const file = app.vault.getAbstractFileByPath(mapPath);
        if (file instanceof TFile) {
            const tfile = await saveTile(app, file, { r, c }, { terrain: "" });
            const leaf = getCenterLeaf(app);
            await leaf.openFile(tfile, { active: true });
        }
    }, { passive: false });

    // --- Drag-Malen ----------------------------------------------------------
    let painting = false;
    let visited: Set<string> | null = null;
    let raf = 0;
    let lastEvt: PointerEvent | null = null;

    const keyRC = (r:number,c:number) => `${r},${c}`;

    function paintStep(ev: PointerEvent): boolean {
        const pt = toContentPoint(ev);
        if (!pt) return false;
        const { r, c } = pointToCoord(pt.x, pt.y);
        const k = keyRC(r, c);
        if (visited && visited.has(k)) return true; // schon gemalt → weiterziehen
        const notCanceled = dispatchHexClick(r, c);
        if (notCanceled === false) visited?.add(k); // Tool hat übernommen
        return notCanceled === false;
    }

    // LMB down → nur dann in den Malmodus gehen, wenn der Editor cancelt
    svg.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        lastEvt = ev;

        // erster Punkt: prüft gleichzeitig, ob Tool übernimmt
        const willPaint = paintStep(ev);
        if (!willPaint) return; // Viewer-Fall → kein Drag, Standardinteraktionen bleiben

        painting = true;
        visited = new Set<string>();
        (svg as any).setPointerCapture?.(ev.pointerId);

        ev.preventDefault(); // blockt Click/Default, Events dürfen weiter zum Kreis
    }, { capture: true });

    svg.addEventListener("pointermove", (ev) => {
        if (!painting) return;
        lastEvt = ev;
        if (!raf) {
            raf = requestAnimationFrame(() => {
                raf = 0;
                if (lastEvt) paintStep(lastEvt);
            });
        }
        ev.preventDefault(); // keine Propagation-Blockade → Kreis-Listener bekommt Events
    }, { capture: true });

    function endPaint(ev: PointerEvent) {
        if (!painting) return;
        painting = false;
        visited?.clear(); visited = null;
        lastEvt = null;
        (svg as any).releasePointerCapture?.(ev.pointerId);
        ev.preventDefault();
    }
    svg.addEventListener("pointerup", endPaint, { capture: true });
    svg.addEventListener("pointercancel", endPaint, { capture: true });


    /* HIER ist das return, vor dem dein neuer Handler stehen muss */
    return {
        svg,
        contentG,
        overlay,
        polyByCoord,
        setFill,
        ensurePolys,
        destroy: () => {
            svg.remove();
            polyByCoord.clear();
        },
    };
}
