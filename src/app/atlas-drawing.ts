import { atlasPaint as shape } from './atlas-canvas-scene';
import { atlasElement as get } from './atlas-dom';
import type { AtlasSelection as Selection, AtlasRoomDrag, AtlasPathDrag } from './atlas-workbench-types';
import type { AtlasRegions } from './atlas-regions';
import type { AtlasOutput } from './atlas-output';
import { mapExtentVisible } from './atlas-scale-policy';
import { atlasWorkplaneData, type AtlasWorkplane } from './atlas-workplane';
import { posedFootprint } from './city-model';
import { MapLabelLayout } from './atlas-cartography';
import type { TerrainSpatialUI } from './terrain-spatial-ui';
import { drawMeasurements, areaMeasures, pathMeasures, radiusMeasures, elementMeasures } from './atlas-measurements';
import { atlasFieldValue } from './atlas-units';
import { regionValue } from './atlas-region-contracts';
import { atlasDrawingMeasurement } from './drawing-ui';
import { dungeonTravelRoute } from './dungeon-travel-console';
import type { LandscapeWorkbench } from "./atlas-landscape-ui";
import { appendRoomNumber } from "./room-number-label";
import { atlasPartyPoint } from "./atlas-runtime-model";
import type { CanvasBox } from "./passive-map-canvas";
import type { AtlasCanvas } from "./atlas-canvas";
import { AtlasPaint } from "./atlas-canvas-scene";
import { atlasFrame, localToAtlas, atlasToLocal, frameMatrix } from "./campaign-atlas-model";
import type { AtlasBinding } from "./campaign-atlas-contracts";
import type { Point, Room } from "./contracts";
import { roadPoints } from "./city-model";
import { volumeProjection } from "./volume-model";
import { elementPaint, roomFacePaint } from "./drawing-model";
import { atlasCityMeasurement } from "./city-ui";
import { atlasDrawingSnapPoint, atlasDrawingDraft, drawingOverlay } from "./drawing-ui";
import { atlasDungeonState } from "./dungeon-ui";
interface AtlasDrawingHost {
    readonly regions: Pick<AtlasRegions, "data" | "geometryCurrent">;
    readonly output: Pick<AtlasOutput, "exportOpen">;
    readonly landscape: Pick<LandscapeWorkbench, "livePainting" | "drawMeasurements">;
    readonly spatial: Pick<TerrainSpatialUI, "screenAnchor"> | undefined;
    readonly canvas: HTMLCanvasElement;
    readonly root: HTMLElement;
    readonly family: string;
    readonly measurementHover: Point | null;
    readonly scopeId: string | null;
    readonly frame: (scopeId: string) => ReturnType<typeof atlasFrame>;
    readonly floorId: string;
    readonly roomDrag: AtlasRoomDrag | null;
    readonly draft: Point[];
    readonly floorPlane: (scopeId?: string, floorId?: string) => AtlasWorkplane | null;
    readonly selection: Selection;
    readonly opts: {
        roomDraft: () => Room | null;
    };
    readonly roomPreview: <T extends import("./contracts").RoomGeometry>(original: T) => T;
    readonly camera: Pick<AtlasCanvas, "view" | "hitAt">;
    readonly pathDrag: AtlasPathDrag | null;
    readonly partyDrag: {
        id: number;
        start: Point;
        last: Point;
    } | null;
}
/** Builds map and author paint commands and owns reusable base geometry. */
export class AtlasDrawing {
    constructor(private host: AtlasDrawingHost) { }
    labelLayout = new MapLabelLayout();
    baseGeometry: {
        key: unknown[];
        node: AtlasPaint;
        origin: Point;
        authorSlot: number[] | null;
    } | null = null;
    drawAuthorMeasurements(root: AtlasPaint, box: CanvasBox, mpp: number) {
        if (!this.host.regions.data || this.host.output.exportOpen || get<HTMLInputElement>('atlas-perception').checked || !this.host.regions.geometryCurrent() && !this.host.landscape.livePainting)
            return;
        const project = (p: Point) => this.host.spatial?.screenAnchor(p) ?? p;
        // A context drawer can overlay the canvas; keep labels on its visible portion.
        const canvasBounds = this.host.canvas.getBoundingClientRect(), details = document.getElementById('atlas-secondary');
        if (details && !details.hidden && this.host.root.dataset.overlay === 'true') {
            const bounds = details.getBoundingClientRect();
            if (bounds.left > canvasBounds.left && bounds.left < canvasBounds.right)
                box = { ...box, width: Math.min(box.width, (bounds.left - canvasBounds.left) * mpp) };
        }
        if (this.host.family === 'terrain') {
            this.host.landscape.drawMeasurements(root, box, mpp, project);
            return;
        }
        const hover = this.host.measurementHover;
        if (this.host.family === 'city') {
            const state = atlasCityMeasurement();
            if (!state)
                return;
            const binding = this.host.regions.data.bindings.find(b => b.kind === 'city' && b.ownerId === state.cityId);
            if (!binding)
                return;
            const frame = atlasFrame(this.host.regions.data, binding), at = hover ? atlasToLocal(hover, frame) : null;
            let points = state.path, lines: string[] = [];
            if (state.tool === 'building' && at) {
                points = [at];
                const size = state.size;
                lines = areaMeasures([{ outer: [{ x: 0, y: 0 }, { x: size, y: 0 }, { x: size, y: size }, { x: 0, y: size }], holes: [] }]);
            }
            else if (state.tool !== 'select' && points.length) {
                points = [...points, ...(at ? [at] : [])];
                lines = ['road', 'wall'].includes(state.tool) ? pathMeasures(points, state.width) : points.length >= 3 ? areaMeasures([{ outer: points, holes: [] }]) : pathMeasures(points);
            }
            else if (state.tool === 'select' && state.unit) {
                const u = state.unit;
                points = u.kind === 'building' ? posedFootprint(u).flatMap(p => p.outer) : ['road', 'wall'].includes(u.kind) ? roadPoints(u, state.units) : u.outline ?? [];
                lines = ['road', 'wall'].includes(u.kind) ? pathMeasures(points, u.width) : areaMeasures(u.kind === 'building' ? posedFootprint(u) : [{ outer: points, holes: [] }]);
            }
            if (state.tool !== 'select' && state.path.length && points.length > 1)
                root.append(shape(['road', 'wall'].includes(state.tool) ? 'polyline' : 'polygon', { points: points.map(p => this.relativePoint(localToAtlas(p, frame))), pointer: false, style: { fill: null, stroke: '#b85c23', lineWidth: mpp * 2 }, data: { editorOnly: 'true' } }));
            if (points.length)
                drawMeasurements(root, box, mpp, localToAtlas(points.at(-1)!, frame), lines, project);
            return;
        }
        if (!['interior', 'decoration'].includes(this.host.family) || !this.host.scopeId)
            return;
        const frame = this.host.frame(this.host.scopeId), state = atlasDrawingMeasurement(hover ? atlasToLocal(hover, frame) : undefined);
        if (!state || state.floor.scopeId !== this.host.scopeId || state.floor.floorId !== this.host.floorId)
            return;
        let points = state.points, lines: string[] = [];
        if (this.host.roomDrag?.moved) {
            const a = atlasDrawingSnapPoint(atlasToLocal(this.host.roomDrag.start, frame)), b = atlasDrawingSnapPoint(atlasToLocal(this.host.roomDrag.last, frame));
            points = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
            lines = areaMeasures([{ outer: points, holes: [] }]);
        }
        else if (this.host.draft.length && state.tool === 'room-rectangle' && hover) {
            const a = this.host.draft[0]!, b = atlasDrawingSnapPoint(atlasToLocal(hover, frame));
            points = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
            lines = areaMeasures([{ outer: points, holes: [] }]);
            root.append(shape('polygon', { points: points.map(p => this.relativePoint(localToAtlas(p, frame))), pointer: false, style: { fill: null, stroke: '#b85c23', lineWidth: mpp * 2 }, data: { editorOnly: 'true', ...atlasWorkplaneData(this.host.floorPlane()) } }));
        }
        else if (['room-cave', 'room-erase', 'scatter'].includes(state.tool) && hover) {
            points = [atlasToLocal(hover, frame)];
            lines = radiusMeasures(state.radius);
            root.append(shape('circle', { x: hover.x - box.x, y: hover.y - box.y, radius: state.radius, pointer: false, style: { fill: null, stroke: '#364354', lineWidth: mpp }, data: { editorOnly: 'true', ...atlasWorkplaneData(this.host.floorPlane()) } }));
        }
        else if (state.tool === 'select') {
            if (this.host.selection?.kind === 'room') {
                const room = this.host.opts.roomDraft();
                if (room && room.id === this.host.selection.id) {
                    const preview = this.host.roomPreview(room);
                    points = preview.polygons.flatMap(p => p.outer);
                    lines = areaMeasures(preview.polygons);
                }
            }
            else if (state.element && state.element.id === this.host.selection?.id) {
                const e = this.pathPreview(state.element);
                points = e.points;
                lines = elementMeasures(e);
            }
        }
        else if (state.polygons?.length) {
            points = state.polygons.flatMap(p => p.outer);
            lines = areaMeasures(state.polygons);
        }
        else if (state.element) {
            points = state.element.points;
            lines = elementMeasures(state.element);
        }
        else if (points.length > 1)
            lines = pathMeasures(points);
        if (state.tool !== 'select' && state.points.length > 1 && !this.host.roomDrag && !['room-cave', 'room-erase', 'scatter', 'room-hole'].includes(state.tool))
            root.append(shape(state.polygons?.length || ['terrain', 'water', 'roof'].includes(state.tool) ? 'polygon' : 'polyline', { points: points.map(p => this.relativePoint(localToAtlas(p, frame))), pointer: false, style: { fill: null, stroke: '#b85c23', lineWidth: mpp * 2 }, data: { editorOnly: 'true', ...atlasWorkplaneData(this.host.floorPlane()) } }));
        if (points.length)
            drawMeasurements(root, box, mpp, localToAtlas(points.at(-1)!, frame), lines, project);
    }
    relativePoint(p: Point) {
        const b = this.host.camera.view;
        return { x: p.x - b.x, y: p.y - b.y };
    }
    relative(f: import("./campaign-atlas-model").AtlasFrame) {
        return { ...f, ...this.relativePoint(f) };
    }
    visible(p: Point, r: number, b: CanvasBox) {
        return (p.x + r >= b.x &&
            p.y + r >= b.y &&
            p.x - r <= b.x + b.width &&
            p.y - r <= b.y + b.height);
    }
    label(root: AtlasPaint, text: string, p: Point, mpp: number) {
        if (this.host.regions.data?.region?.labels)
            return;
        if (root.data.mapScene)
            p = this.relativePoint(p);
        const t = shape("text", { x: p.x, y: p.y - 8 * mpp, pointer: false, style: { fontSize: 12 * mpp, textAlign: 'center', stroke: "#f2eee3", lineWidth: 3 * mpp, fill: "#283d3b" } });
        t.text = text;
        root.append(t);
    }
    drawTerrain(root: AtlasPaint, box: CanvasBox, _mpp: number) { const cover = this.host.regions.data?.region?.box ?? box; root.append(shape("rect", { x: cover.x - box.x, y: cover.y - box.y, width: cover.width, height: cover.height, style: { fill: "#7fa8bd" }, data: { spatialGround: "true" } })); }
    drawInterior(root: AtlasPaint, b: AtlasBinding, box: CanvasBox, mpp: number) {
        const data = this.host.regions.data!, f = this.host.frame(b.ownerId), rooms = data.workspace.rooms.filter((r) => r.scopeId === b.ownerId), building = b.parent === "building"
            ? data.cities.flatMap((c) => c.units).find((u) => u.id === b.parentId)
            : null;
        if (building &&
            get<HTMLInputElement>("atlas-roofs").checked &&
            mpp > 0.4 &&
            b.ownerId !== this.host.scopeId)
            return;
        const floor = b.ownerId === this.host.scopeId ? this.host.floorId : "ground", shown = rooms.filter((r) => r.floorId === floor), elements = data.geometry.drawing.elements.filter(e => e.scopeId === b.ownerId && e.floorId === floor && !e.archived);
        if (b.parent === "world" && (shown.length || elements.length || !!regionValue(data.region?.scopeBounds, b.ownerId))) {
            const points = [...shown.flatMap((r) => r.polygons.flatMap((p) => p.outer)), ...elements.flatMap(e => e.points)], extentBox = regionValue(data.region?.scopeBounds, b.ownerId), extent = extentBox?.width ?? (points.length
                ? Math.max(...points.map((p) => p.x)) -
                    Math.min(...points.map((p) => p.x))
                : 0), height = extentBox?.height ?? (points.length ? Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) : 0);
            if (!mapExtentVisible(extent, height, mpp))
                return;
        }
        if (!shown.length && !elements.length)
            return;
        const g = shape("group", { matrix: frameMatrix(this.relative(f)), data: atlasWorkplaneData(this.host.floorPlane(b.ownerId, floor)) });
        for (const saved of shown) {
            if (this.authorRoom(saved)) {
                g.append(shape('group', { data: { authorRoomFace: saved.id } }));
                continue;
            }
            let room = this.host.opts.roomDraft()?.id === saved.id ? this.host.opts.roomDraft()! : saved;
            room = this.host.roomPreview(room);
            const at = localToAtlas(room.polygons[0]!.outer[0]!, f);
            if (!this.visible(at, Math.max(...room.polygons.flatMap((p) => p.outer.map((p) => Math.hypot(p.x, p.y)))) + 30, data.region?.box ?? box))
                continue;
            const slice = get<HTMLInputElement>("atlas-slice-enabled").checked &&
                b.ownerId === this.host.scopeId, z = Number(atlasFieldValue(get<HTMLInputElement>("atlas-slice"))), elevation = data.geometry.floors.find((f) => f.scopeId === b.ownerId && f.id === floor)?.elevation ?? 0, volume = data.geometry.drawing.volumes?.find((v) => v.roomId === room.id);
            const polygons = slice && !data.region
                ? volume
                    ? volumeProjection(volume, (z - elevation) / 1.524)
                    : z >= elevation &&
                        z <
                            elevation +
                                (data.geometry.drawing.styles.find((s) => s.id === room.id)
                                    ?.ceilingMeters ?? 3.048)
                        ? room.polygons
                        : []
                : room.polygons;
            if (!polygons.length)
                continue;
            if (!this.authorRoom(room))
                this.drawRoomFace(g, { ...room, polygons }, mpp);
        }
        for (const e of elements) {
            const node = elementPaint(e, shown, data.geometry.drawing.elements);
            node.data.atlasObject = 'true';
            node.data.kind = 'element';
            node.data.id = e.id;
            g.append(node);
        }
        this.drawInteriorRuntime(g, b, floor, mpp, shown);
        root.append(g);
    }
    authorRoom(room: import('./contracts').RoomGeometry) {
        return !this.host.output.exportOpen && this.host.family === 'interior' && this.host.selection?.kind === 'room' && this.host.selection.id === room.id &&
            this.host.opts.roomDraft()?.id === room.id && room.scopeId === this.host.scopeId && room.floorId === this.host.floorId &&
            !get<HTMLInputElement>('atlas-slice-enabled').checked && !get<HTMLInputElement>('atlas-perception').checked;
    }
    authorFaceSlot(node: AtlasPaint): number[] | null {
        if (node.data.authorRoomFace)
            return [];
        for (let i = 0; i < node.children.length; i++) {
            const child = this.authorFaceSlot(node.children[i]!);
            if (child)
                return [i, ...child];
        }
        return null;
    }
    withAuthorFace(node: AtlasPaint, slot: number[], mpp: number): AtlasPaint {
        const copy = shape(node.kind, node.geometry, node.text);
        copy.title = node.title;
        if (slot.length) {
            copy.append(...node.children);
            const index = slot[0]!;
            copy.children[index] = this.withAuthorFace(node.children[index]!, slot.slice(1), mpp);
        }
        else {
            const original = this.host.opts.roomDraft();
            if (original) {
                const room = this.host.roomPreview(original);
                this.drawRoomFace(copy, room, mpp);
            }
        }
        return copy;
    }
    drawRoomFace(g: AtlasPaint, room: import('./contracts').RoomGeometry, mpp: number) {
        const path = roomFacePaint(room, mpp, this.host.regions.data?.geometry.drawing.styles.find(s => s.id === room.id), this.host.selection?.id === room.id);
        path.data.atlasObject = "true";
        path.data.kind = "room";
        path.data.id = room.id;
        g.append(path);
        if (!this.host.regions.data?.region?.labels)
            appendRoomNumber(g, room, mpp);
        const vertices = room.polygons[0]!.outer;
        if ((Math.max(...vertices.map((p) => p.x)) -
            Math.min(...vertices.map((p) => p.x))) /
            mpp >
            60)
            this.label(g, room.name.slice(0, 40), {
                x: vertices.reduce((n, p) => n + p.x, 0) / vertices.length,
                y: vertices.reduce((n, p) => n + p.y, 0) / vertices.length,
            }, mpp);
    }
    pathPreview(original: import('./drawing-contracts').DrawingElement) {
        const drag = this.host.pathDrag;
        if (!drag || drag.element.id !== original.id)
            return original;
        // The snapshot stays read-only; only the edited point needs a new object.
        const points = drag.element.points.slice();
        if (drag.insert)
            points.splice(drag.index + 1, 0, { ...drag.point });
        else
            points[drag.index] = { ...drag.point };
        return { ...original, points };
    }
    drawInteriorAuthor(root: AtlasPaint, mpp: number) {
        const data = this.host.regions.data;
        if (!data || !this.host.scopeId || !['interior', 'decoration'].includes(this.host.family) ||
            get<HTMLInputElement>('atlas-perception').checked)
            return;
        const binding = data.bindings.find(b => b.kind === 'dungeon' && b.ownerId === this.host.scopeId);
        if (!binding)
            return;
        const frame = atlasFrame(data, binding), g = shape('group', {
            matrix: frameMatrix(this.relative(frame)),
            data: { editorOnly: 'true', ...atlasWorkplaneData(this.host.floorPlane()) },
        });
        const original = this.host.opts.roomDraft();
        if (this.host.family === 'interior' && this.host.selection?.kind === 'room' &&
            original?.id === this.host.selection.id && original.scopeId === this.host.scopeId &&
            original.floorId === this.host.floorId && !get<HTMLInputElement>('atlas-slice-enabled').checked) {
            const room = this.host.roomPreview(original);
            if (data.region?.raster)
                g.append(shape('polygons', {
                    polygons: room.polygons, pointer: false,
                    style: { fill: null, stroke: '#b85525', lineWidth: Math.max(.07, mpp * 2) },
                }));
            // Stale backgrounds may stay visible; their author handles must not remain actionable.
            if (this.host.regions.geometryCurrent() && get<HTMLSelectElement>('drawing-tool').value !== 'door') {
                const cover = data.region?.box ?? this.host.camera.view, cells = new Set<string>();
                // A detailed original must not turn into thousands of overlapping handles.
                // Each retained handle still addresses its exact original polygon/vertex.
                let spacing = mpp * 8;
                while ((Math.ceil(cover.width / spacing) + 2) * (Math.ceil(cover.height / spacing) + 2) > 1500)
                    spacing *= 2;
                room.polygons.forEach((poly, pi) => poly.outer.forEach((p, vi) => {
                    const at = localToAtlas(p, frame);
                    if (at.x < cover.x || at.y < cover.y || at.x > cover.x + cover.width || at.y > cover.y + cover.height)
                        return;
                    const cell = Math.floor(at.x / spacing) + ':' + Math.floor(at.y / spacing);
                    if (cells.has(cell))
                        return;
                    cells.add(cell);
                    g.append(shape('circle', {
                        x: p.x, y: p.y, radius: mpp * 4,
                        style: { fill: 'white', stroke: '#244f87', lineWidth: mpp },
                        data: { atlasObject: 'true', kind: 'vertex', id: room.id, atlasVertex: String(vi), polygon: String(pi) },
                    }));
                }));
                const edges = new Set<string>();
                room.polygons.forEach((poly, pi) => poly.outer.forEach((a, vi) => {
                    const b = poly.outer[(vi + 1) % poly.outer.length]!;
                    // Leave corners distinct and omit subpixel/dense edges at this scale.
                    if (Math.hypot(b.x - a.x, b.y - a.y) < mpp * 24)
                        return;
                    const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, at = localToAtlas(p, frame);
                    if (at.x < cover.x || at.y < cover.y || at.x > cover.x + cover.width || at.y > cover.y + cover.height)
                        return;
                    const cell = Math.floor(at.x / spacing) + ':' + Math.floor(at.y / spacing);
                    if (cells.has(cell) || edges.has(cell))
                        return;
                    edges.add(cell);
                    g.append(shape('circle', {
                        x: p.x, y: p.y, radius: mpp * 4,
                        title: 'Wand parallel verschieben',
                        style: { fill: '#244f87', stroke: 'white', lineWidth: mpp },
                        data: { atlasObject: 'true', kind: 'edge', id: room.id, atlasEdge: String(vi), polygon: String(pi) },
                    }));
                }));
                const vertices = room.polygons.reduce((n, p) => n + p.outer.length, 0);
                if (cells.size < vertices)
                    g.title = `${cells.size} von ${vertices} Eckpunkten als Griffe. Für weitere Griffe näher heranzoomen oder verschieben.`;
            }
        }
        const draft = atlasDrawingDraft();
        if (draft.floor.scopeId === this.host.scopeId && draft.floor.floorId === this.host.floorId) {
            drawingOverlay(g, true);
            if (draft.polygons)
                g.append(shape('polygons', {
                    polygons: draft.polygons,
                    style: { fill: '#d98f5555', stroke: '#b85c23', lineWidth: .1 },
                }));
        }
        const selected = atlasDrawingDraft().element;
        if (this.host.selection?.kind === 'element' && selected?.id === this.host.selection.id && selected.kind === 'path' && selected.scopeId === this.host.scopeId && selected.floorId === this.host.floorId && this.host.regions.geometryCurrent() && get<HTMLSelectElement>('drawing-tool').value === 'select' && !get<HTMLInputElement>('atlas-slice-enabled').checked) {
            const path = this.pathPreview(selected);
            g.append(shape('polyline', { points: path.points, pointer: false, style: { fill: null, stroke: '#236871', lineWidth: Math.max(mpp * 2, .08) } }));
            const cells = new Set<string>(), cover = this.host.camera.view;
            const grip = (p: Point, index: number, insert: boolean) => { const at = localToAtlas(p, frame), cell = Math.floor(at.x / (mpp * 12)) + ':' + Math.floor(at.y / (mpp * 12)); if (cells.size >= 1500 || cells.has(cell) || at.x < cover.x || at.y < cover.y || at.x > cover.x + cover.width || at.y > cover.y + cover.height)
                return; cells.add(cell); g.append(shape('circle', { x: p.x, y: p.y, radius: mpp * 5, title: insert ? 'Ziehen fügt einen Knickpunkt ein' : 'Pfadpunkt ziehen · Escape verwirft', style: { fill: insert ? '#244f87' : 'white', stroke: insert ? 'white' : '#244f87', lineWidth: mpp }, data: { atlasObject: 'true', kind: 'path-grip', id: selected.id, [insert ? 'atlasPathInsert' : 'atlasPathVertex']: String(index) } })); };
            path.points.forEach((p, i) => { grip(p, i, false); const next = path.points[i + 1]; if (!this.host.pathDrag && next && Math.hypot(next.x - p.x, next.y - p.y) > mpp * 24)
                grip({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 }, i, true); });
        }
        if (g.children.length)
            root.append(g);
    }
    drawInteriorRuntime(g: AtlasPaint, b: AtlasBinding, floor: string, mpp: number, shown: import('./contracts').RoomGeometry[]) {
        const data = this.host.regions.data!;
        const runtime = atlasDungeonState(), route = dungeonTravelRoute(data.geometry.journey, runtime.preview, data.geometry.sceneId);
        const points = route.filter((p) => p.scopeId === b.ownerId && p.floorId === floor);
        if (points.length)
            g.append(shape("polyline", { points, style: { fill: null, stroke: "#b05c36", lineWidth: Math.max(0.15, mpp * 2) } }));
        const party = data.geometry.position, perception = data.perception, masked = get<HTMLInputElement>("atlas-perception").checked;
        for (const t of data.geometry.tracks.filter((t) => t.from.scopeId === b.ownerId &&
            t.from.floorId === floor &&
            t.to.floorId === floor)) {
            if (masked &&
                !perception?.tracks?.some((x) => x.from.x === t.from.x &&
                    x.from.y === t.from.y &&
                    x.to.x === t.to.x &&
                    x.to.y === t.to.y))
                continue;
            g.append(shape("line", { x: t.from.x, y: t.from.y, x2: t.to.x, y2: t.to.y, style: { fill: null, stroke: "#987cb0", lineWidth: Math.max(0.08, mpp), lineDash: [mpp * 3, mpp * 3] } }));
        }
        for (const n of data.geometry.npcs.filter((n) => n.pose?.scopeId === b.ownerId && n.pose.floorId === floor)) {
            const observation = data.geometry.senses.observations.find((o) => o.subjectKind === "actor" &&
                o.subjectId === n.id &&
                o.known &&
                o.visible &&
                o.override !== "unknown");
            if (masked && !observation)
                continue;
            const dot = shape("circle", { x: n.pose!.x, y: n.pose!.y, radius: Math.max(0.15, mpp * 5), style: { fill: "#8964a5", stroke: "#fff", lineWidth: mpp } });
            dot.title =
                n.name + (observation ? " · bekannt und sichtbar" : " · GM");
            g.append(dot);
            if (!masked) {
                const points = n.path.filter((p) => p.scopeId === b.ownerId && p.floorId === floor);
                if (points.length)
                    g.append(shape("polyline", { points, style: { fill: null, stroke: "#8964a5", lineWidth: mpp } }));
            }
        }
        if (masked &&
            party?.scopeId === b.ownerId &&
            party.floorId === floor &&
            perception) {
            const points = shown.length ? shown.flatMap((r) => r.polygons.flatMap((p) => p.outer)) : [{ x: this.host.camera.view.x, y: this.host.camera.view.y }, { x: this.host.camera.view.x + this.host.camera.view.width, y: this.host.camera.view.y }, { x: this.host.camera.view.x + this.host.camera.view.width, y: this.host.camera.view.y + this.host.camera.view.height }, { x: this.host.camera.view.x, y: this.host.camera.view.y + this.host.camera.view.height }].map(p => atlasToLocal(p, this.host.frame(b.ownerId))), minX = Math.min(...points.map((p) => p.x)) - 1, minY = Math.min(...points.map((p) => p.y)) - 1, width = Math.max(...points.map((p) => p.x)) - minX + 1, height = Math.max(...points.map((p) => p.y)) - minY + 1;
            g.append(shape("rect", { x: minX, y: minY, width, height, opacity: .9, pointer: false, style: { fill: '#1e292b' }, maskCuts: [
                    ...perception.known.length ? [{ polygons: perception.known, alpha: .6 }] : [],
                    ...perception.visible.length ? [{ polygons: perception.visible, alpha: 1 }] : [],
                ] }));
        }
    }
    drawParty(root: AtlasPaint, mpp: number) {
        const d = this.host.regions.data!, position = this.host.partyDrag?.last ?? atlasPartyPoint(d);
        if (!position)
            return;
        const token = shape("circle", { x: position.x - this.host.camera.view.x, y: position.y - this.host.camera.view.y, radius: mpp * 7, style: { fill: "#244f87", stroke: "white", lineWidth: mpp * 2 } });
        token.data.atlasObject = "true";
        token.data.kind = "party";
        root.append(token);
        this.label(root, d.geometry.sceneTitle, position, mpp);
    }
}
