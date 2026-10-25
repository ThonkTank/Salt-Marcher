import { atlasPathPreview } from './atlas-path-draft';
import { atlasElement as get } from './atlas-dom';
import type {
  AtlasSelection as Selection,
  AtlasFamily as Family,
  AtlasRoomDrag,
  AtlasPathDrag,
} from './atlas-workbench-types';
import type { AtlasRegions } from './atlas-regions';
import type { AtlasJourney } from './atlas-journey';
import type { AtlasOutput } from './atlas-output';
import { vegetationInstances } from './vegetation-projection';
import { atlasFieldValue } from './atlas-units';
import { regionValue } from './atlas-region-contracts';
import { selectElement } from './drawing-ui';
import type { LandscapeWorkbench } from './atlas-landscape-ui';
import { atlasPartyPoint } from './atlas-runtime-model';
import { atlasWorldTarget } from '../world-ui';
import type { AtlasCanvas } from './atlas-canvas';
import { atlasFrame, localToAtlas, atlasToLocal, atlasHexAt } from './campaign-atlas-model';
import type { AtlasAction } from './campaign-atlas-contracts';
import type { WorkspaceGeometry, Point, Room } from '../contracts';
import { atlasCityPoint, openCityReference } from './city-ui';
import {
  atlasDrawingPoint,
  atlasDrawingRectangle,
  atlasDrawingSnapPoint,
  atlasDrawingDraft,
} from './drawing-ui';
import { atlasDungeonTarget } from './dungeon-ui';
interface AtlasAuthorHost {
  creation: 'city' | 'dungeon' | null;
  readonly root: HTMLElement;
  readonly family: Family;
  readonly output: Pick<
    AtlasOutput,
    | 'exportOpen'
    | 'exportChoosing'
    | 'exporting'
    | 'exportDrag'
    | 'exportCorner'
    | 'exportDungeon'
    | 'exportBox'
    | 'exportRectangle'
    | 'exportAreaStatus'
    | 'beginArea'
    | 'moveArea'
    | 'endArea'
  >;
  readonly busy: boolean;
  readonly spacePan: boolean;
  readonly camera: Pick<AtlasCanvas, 'ready' | 'hitAt' | 'stopZoom' | 'redrawOverlay'>;
  readonly regions: Pick<
    AtlasRegions,
    'data' | 'geometryCurrent' | 'refresh' | 'loadedRegionQuery' | 'scheduleRegion'
  >;
  readonly opts: {
    selectRoom: (id: string) => Promise<void>;
    roomDraft: () => Room | null;
    status: (text: string, error?: boolean) => void;
  };
  readonly point: (event: MouseEvent) => Point;
  readonly createCity: () => Promise<void>;
  readonly createRoomGroup: (mode?: 'interior' | 'building') => Promise<void>;
  readonly setFamily: (family: Family, flush?: boolean) => Promise<void>;
  readonly landscape: Pick<LandscapeWorkbench, 'hasDraft' | 'selectVegetation' | 'selectId'>;
  readonly entranceHeight: (
    entrances: import('./atlas-travel-contracts').AtlasEntrance[],
  ) => Promise<void> | undefined;
  readonly chooseAt: (
    point: Point,
    layer?: 'geometry' | 'landscape' | 'all',
    visualElementId?: string,
  ) => Promise<void>;
  readonly owner: WorkspaceGeometry | null;
  readonly navigateElement: (id: string, focus?: boolean) => Promise<void>;
  readonly navigateScope: (id: string) => Promise<void>;
  readonly navigate: (kind: 'city' | 'room', id: string, unitId?: string) => Promise<void>;
  scopeId: string | null;
  readonly frame: (scopeId: string) => ReturnType<typeof atlasFrame>;
  readonly write: (
    action: AtlasAction,
    applyWorkspace?: boolean,
    propagateError?: boolean,
    terrain?: import('./terrain-live-stroke').TerrainLiveContext,
  ) => Promise<{
    atlas: import('./campaign-atlas-contracts').AtlasRenderView;
    result: unknown;
    ack: import('./campaign-atlas-contracts').AtlasCommitAck;
  } | null>;
  readonly render: (preview?: boolean) => void;
  readonly journey: Pick<
    AtlasJourney,
    | 'entranceId'
    | 'localPreview'
    | 'travelReadState'
    | 'invalidatePreview'
    | 'selectEntrance'
    | 'travel'
    | 'renderTravel'
  >;
  cityId: string | null;
  readonly doorRoomAt: (point: Point) => Promise<{
    room: import('../contracts').RoomGeometry;
    maxDistance: number;
  }>;
  readonly chooseScope: (id: string) => void;
  floorId: string;
  readonly syncDrawingFloor: () => void;
  readonly error: (error: unknown) => void;
  readonly cancel: () => void;
  readonly canvas: HTMLCanvasElement;
}
/** Owns author selection, pointer gestures and temporary geometry. */
export class AtlasAuthor {
  constructor(private host: AtlasAuthorHost) {}
  selection: Selection = null;
  draft: Point[] = [];
  measurementHover: Point | null = null;
  lastPoint: Point = { x: 0, y: 0 };
  drag: {
    id: number;
    start: Point;
    last: Point;
    selection: Selection;
  } | null = null;
  vertexDrag: {
    id: number;
    room: Room;
    polygon: number;
    vertex: number;
    point: Point;
    edge?: boolean;
    start?: Point;
  } | null = null;
  pathDrag: AtlasPathDrag | null = null;
  private rectanglePhase: 'idle' | 'writing' | 'selecting' = 'idle';
  get rectangleCommit() {
    return this.rectanglePhase !== 'idle';
  }
  roomDrag: AtlasRoomDrag | null = null;
  brushId: number | null = null;
  brushQueue = Promise.resolve();
  ignoreClick = false;
  partyDrag: {
    id: number;
    start: Point;
    last: Point;
  } | null = null;
  placeIntent: {
    point: Point;
    token: string;
    sceneId: string;
    revision: number;
    membership: number;
  } | null = null;
  entranceDraft: Point[] | null = null;
  hasDraft() {
    return !!(
      this.draft.length ||
      this.brushId !== null ||
      this.drag ||
      this.vertexDrag ||
      this.pathDrag ||
      this.roomDrag ||
      this.partyDrag ||
      this.entranceDraft ||
      this.placeIntent ||
      this.rectanglePhase === 'writing'
    );
  }
  blocksNavigation() {
    return this.hasDraft() || this.rectangleCommit;
  }
  cancelGesture() {
    this.brushId = null;
    this.vertexDrag = null;
    this.pathDrag = null;
    this.roomDrag = null;
    this.partyDrag = null;
    this.entranceDraft = null;
    this.placeIntent = null;
    this.draft = [];
    this.drag = null;
  }
  resetContext() {
    this.cancelGesture();
    this.selection = null;
    this.measurementHover = null;
  }
  roomPreview<T extends import('../contracts').RoomGeometry>(original: T): T {
    const drag = this.vertexDrag;
    if (!drag || drag.room.id !== original.id) return original;
    const polygon = drag.room.polygons[drag.polygon]!,
      outer = polygon.outer;
    let points: Point[] | undefined;
    const move = (index: number, point: Point) => {
      const before = outer[index]!;
      if (before.x === point.x && before.y === point.y) return;
      (points ??= [...outer])[index] = point;
    };
    if (!drag.edge) move(drag.vertex, { ...drag.point });
    else {
      const a = outer[drag.vertex]!,
        next = (drag.vertex + 1) % outer.length,
        b = outer[next]!;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        length = Math.hypot(dx, dy);
      if (length && drag.start) {
        const nx = -dy / length,
          ny = dx / length;
        const distance = (drag.point.x - drag.start.x) * nx + (drag.point.y - drag.start.y) * ny;
        move(drag.vertex, { ...a, x: a.x + nx * distance, y: a.y + ny * distance });
        move(next, { ...b, x: b.x + nx * distance, y: b.y + ny * distance });
      }
    }
    if (!points) return original;
    const polygons = [...drag.room.polygons];
    polygons[drag.polygon] = { ...polygon, outer: points };
    return { ...original, polygons };
  }
  pointToolActive() {
    return (
      this.host.creation != null ||
      this.host.root.dataset.roomDraw === 'true' ||
      this.entranceDraft != null ||
      ((this.host.family === 'interior' || this.host.family === 'decoration') &&
        get<HTMLSelectElement>('drawing-tool').value !== 'select') ||
      (this.host.family === 'city' && get<HTMLSelectElement>('city-tool').value !== 'select')
    );
  }
  async click(e: MouseEvent) {
    if (this.ignoreClick) {
      this.ignoreClick = false;
      return;
    }
    if (
      this.host.output.exportOpen ||
      this.host.busy ||
      this.rectangleCommit ||
      this.host.root.dataset.panMode === 'true' ||
      this.host.spacePan ||
      e.altKey ||
      e.button !== 0 ||
      this.drag ||
      this.vertexDrag ||
      this.pathDrag
    )
      return;
    if (!this.host.camera.ready || !this.host.regions.geometryCurrent()) {
      this.host.opts.status('Kartenausschnitt wird vorbereitet.');
      return;
    }
    const p = this.host.point(e);
    this.lastPoint = p;
    if (this.host.creation) {
      const kind = this.host.creation;
      this.host.creation = null;
      delete this.host.root.dataset.placing;
      if (kind === 'city') await this.host.createCity();
      else await this.host.createRoomGroup();
      return;
    }
    const target = this.host.camera.hitAt(e, ['atlasObject']),
      kind = target?.data.kind,
      id = target?.data.id;
    try {
      if (this.host.family === 'terrain') return;
      const selecting =
        !this.pointToolActive() &&
        ['navigation', 'interior', 'decoration', 'city'].includes(this.host.family);
      if (selecting) {
        const hit = this.host.camera.hitAt(e, ['vegetationInstance']),
          area = this.host.regions.data?.region?.landscape?.records.find(
            (r) => r.id === hit?.data.landscapeId,
          ),
          instance = vegetationInstances(area?.vegetationView).find(
            (i) => i.id === hit?.data.vegetationInstance,
          );
        if (area && instance) {
          await this.host.setFamily('terrain');
          await this.host.landscape.selectVegetation(area.id, instance);
          return;
        }
      }
      if (selecting && kind === 'entrance' && id) {
        const entrance = this.host.regions.data?.entrances.find((e) => e.id === id);
        if (entrance) await this.host.entranceHeight([entrance]);
        return;
      }
      if (selecting && this.host.regions.geometryCurrent()) {
        await this.host.chooseAt(p, 'all', kind === 'element' ? id : undefined);
        return;
      }
      if (
        !this.pointToolActive() &&
        !target &&
        this.host.regions.data?.region?.raster &&
        this.host.owner &&
        this.host.regions.loadedRegionQuery
      ) {
        if (!this.host.regions.geometryCurrent()) {
          this.host.opts.status('Kartenausschnitt wird geladen.');
          return;
        }
        const owner = this.host.owner,
          r = await window.campaign.atlasRegionHit(
            owner.token,
            this.host.regions.loadedRegionQuery,
            p,
            this.host.regions.data.region.fence,
          );
        if (this.host.owner !== owner) return;
        if (!r.ok) throw new Error(r.error);
        const hit = r.value;
        if (hit) {
          if (hit.kind === 'element') await this.host.navigateElement(hit.id);
          else if (hit.kind === 'scope') await this.host.navigateScope(hit.id);
          else
            await this.host.navigate(
              hit.kind === 'room' ? 'room' : 'city',
              hit.cityId ?? hit.id,
              hit.cityId ? hit.id : undefined,
            );
        }
        return;
      }
      if (this.entranceDraft !== null && this.host.scopeId && this.selection?.kind === 'room') {
        this.entranceDraft.push(atlasToLocal(p, this.host.frame(this.host.scopeId)));
        if (this.entranceDraft.length === 2) {
          const r = this.host.regions.data!.workspace.rooms.find(
            (r) => r.id === this.selection!.id,
          )!;
          const result = await this.host.write({
            kind: 'entrance',
            entrance: {
              id: crypto.randomUUID(),
              scopeId: r.scopeId,
              roomId: r.id,
              floorId: r.floorId,
              outside: this.entranceDraft[0]!,
              inside: this.entranceDraft[1]!,
              revision: 0,
            },
          });
          if (result) this.entranceDraft = null;
        }
        this.host.render();
        return;
      }
      if (this.host.family === 'travel') {
        this.host.journey.invalidatePreview();
        if (kind === 'entrance' && id) {
          this.host.journey.selectEntrance(id);
          this.host.render();
          return;
        }
        this.host.journey.selectEntrance(null);
        this.host.journey.renderTravel();
      }
      if (this.host.root.dataset.roomDraw === 'true') {
        if (!this.host.scopeId) throw new Error('Zuerst eine Raumgruppe wählen oder anlegen.');
        const local = atlasDrawingSnapPoint(atlasToLocal(p, this.host.frame(this.host.scopeId)));
        this.draft.push(local);
        get('atlas-draft-cancel').hidden = false;
        if (this.draft.length === 2) await this.createRoomRectangle();
        this.host.render();
        return;
      }
      // Buildings are world geometry, even when a legacy city is selected.
      if (this.host.family === 'city' && get<HTMLSelectElement>('city-tool').value === 'building') {
        await this.host.createRoomGroup('building');
        return;
      }
      if (
        this.host.family === 'city' &&
        this.host.cityId &&
        get<HTMLSelectElement>('city-tool').value !== 'select'
      ) {
        const b = this.host.regions.data?.bindings.find(
          (b) => b.kind === 'city' && b.ownerId === this.host.cityId,
        );
        if (b) {
          await atlasCityPoint(atlasToLocal(p, atlasFrame(this.host.regions.data!, b)));
          this.host.render();
        }
        return;
      }
      if (
        (this.host.family === 'decoration' || this.host.family === 'interior') &&
        this.host.scopeId &&
        get<HTMLSelectElement>('drawing-tool').value !== 'select'
      ) {
        const door = get<HTMLSelectElement>('drawing-tool').value === 'door';
        const task = atlasDrawingPoint(
          atlasToLocal(p, this.host.frame(this.host.scopeId)),
          door ? this.brushQueue : undefined,
          () => this.host.doorRoomAt(p),
        );
        if (door) {
          const committed = task.then(async () => {
            await this.host.regions.refresh();
          });
          this.brushQueue = committed.catch(() => {});
          await committed;
        } else await task;
        this.host.render();
        return;
      }
      if (kind === 'party' && this.host.family === 'travel') {
        const at = atlasPartyPoint(this.host.regions.data!),
          near = this.host.regions.data!.entrances.filter((e) => {
            const b = this.host.regions.data!.bindings.find(
              (b) => b.kind === 'dungeon' && b.ownerId === e.scopeId,
            );
            if (!b || !at) return false;
            const point = localToAtlas(
              this.host.regions.data!.geometry.position ? e.inside : e.outside,
              atlasFrame(this.host.regions.data!, b),
            );
            return Math.hypot(point.x - at.x, point.y - at.y) <= 3.048;
          });
        if (near.length === 1) this.host.journey.selectEntrance(near[0]!.id);
        this.host.journey.renderTravel();
        return;
      }
      if (kind === 'scope' && id) {
        this.host.chooseScope(id);
        return;
      }
      if (kind === 'room' && id) {
        const room = this.host.regions.data!.workspace.rooms.find((r) => r.id === id)!;
        this.selection = { kind: 'room', id };
        this.host.scopeId = room.scopeId;
        this.host.floorId = room.floorId;
        if (this.host.family === 'travel')
          await atlasDungeonTarget(id, atlasToLocal(p, this.host.frame(room.scopeId)));
        else {
          await this.host.opts.selectRoom(id);
          this.host.syncDrawingFloor();
        }
        this.host.render();
        return;
      }
      if ((kind === 'building' || kind === 'city-unit') && id) {
        const cityId = target!.data.cityId!;
        this.host.cityId = cityId;
        this.selection = { kind: kind as 'building' | 'city-unit', id, cityId };
        const binding = this.host.regions.data?.bindings.find(
          (b) => b.parent === 'building' && b.parentId === id,
        );
        const interiorScope =
          binding?.ownerId ?? regionValue(this.host.regions.data?.region?.interiors, id);
        if (interiorScope) {
          this.host.scopeId = interiorScope;
          this.host.floorId = 'ground';
          this.host.syncDrawingFloor();
        }
        await openCityReference(cityId, id, true);
        this.host.render();
        this.host.regions.scheduleRegion();
        return;
      }
      if (kind === 'city' && id) {
        this.host.cityId = id;
        this.selection = { kind: 'city', id };
        await openCityReference(id, undefined, true);
        this.host.render();
        return;
      }
      if (this.host.family === 'travel')
        atlasWorldTarget(atlasHexAt(p, this.host.regions.data!.terrain.hexMeters));
    } catch (e) {
      this.host.error(e);
    }
  }
  async createRoomRectangle() {
    const owner = this.host.owner,
      scope = this.host.scopeId,
      floor = this.host.floorId,
      append = get<HTMLInputElement>('drawing-append').checked;
    const current = () =>
      this.host.owner === owner && this.host.scopeId === scope && this.host.floorId === floor;
    const [a, b] = this.draft as [Point, Point];
    if (Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01) {
      this.draft = [a];
      throw new Error('Raum benötigt eine Fläche. Zweite Ecke erneut wählen.');
    }
    this.rectanglePhase = 'writing';
    try {
      let result;
      try {
        result = await atlasDrawingRectangle(a, b);
      } catch (error) {
        if (current()) this.draft = [a];
        throw error;
      }
      if (result && current()) {
        this.host.cancel();
        // The write is confirmed; room selection flushes this same author.
        this.rectanglePhase = 'selecting';
        const id = result.workspace.selectedId!;
        await this.host.opts.selectRoom(id);
        if (!current()) return;
        this.selection = { kind: 'room', id };
        // Selecting the new room persists its context and changes the source fence.
        await this.host.regions.refresh();
        if (!current()) return;
        // Continue creating rooms; an append finishes the selected room instead.
        if (!append) {
          get<HTMLSelectElement>('drawing-tool').value = 'room-rectangle';
          get('drawing-tool').dispatchEvent(new window.Event('change', { bubbles: true }));
          get('atlas-room-draw').click();
        }
      } else if (current()) this.draft = [a];
    } finally {
      this.rectanglePhase = 'idle';
    }
  }
  suppressClick() {
    this.ignoreClick = true;
  }
  lastBrushPoint: Point | null = null;
  queueBrush(p: Point) {
    const scope = this.host.scopeId;
    if (!scope) return;
    const local = atlasToLocal(p, this.host.frame(scope));
    const radius = Number(atlasFieldValue(get<HTMLInputElement>('drawing-brush')));
    if (
      this.lastBrushPoint &&
      Math.hypot(local.x - this.lastBrushPoint.x, local.y - this.lastBrushPoint.y) < radius / 4
    )
      return;
    this.lastBrushPoint = local;
    this.brushQueue = atlasDrawingPoint(local, this.brushQueue)
      .then(() => {
        this.host.render();
      })
      .catch((e) => this.host.error(e));
  }
  down(e: PointerEvent) {
    this.ignoreClick = false; // A real press starts a new gesture; delayed drag clicks are consumed by click().
    if (
      e.button !== 0 ||
      e.altKey ||
      this.host.spacePan ||
      this.host.root.dataset.panMode === 'true'
    )
      return;
    if (
      this.host.busy ||
      this.rectangleCommit ||
      !this.host.regions.geometryCurrent() ||
      !this.host.camera.ready
    ) {
      // A rejected press owns its release/click, even if the frame finishes meanwhile.
      this.suppressClick();
      return;
    }
    if (this.host.output.exportOpen) {
      this.host.output.beginArea(e, this.host.point(e));
      return;
    }
    if (this.host.creation || (this.host.family === 'terrain' && this.host.regions.data)) return;
    if (
      (this.host.family === 'interior' || this.host.family === 'decoration') &&
      this.host.scopeId &&
      ['room-cave', 'room-erase', 'scatter'].includes(get<HTMLSelectElement>('drawing-tool').value)
    ) {
      this.lastBrushPoint = null;
      this.brushId = e.pointerId;
      this.host.canvas.setPointerCapture(e.pointerId);
      this.queueBrush(this.host.point(e));
      return;
    }
    if (this.host.root.dataset.roomDraw === 'true' && this.host.scopeId) {
      const p = this.host.point(e);
      this.roomDrag = {
        id: e.pointerId,
        scopeId: this.host.scopeId,
        floorId: this.host.floorId,
        start: p,
        last: p,
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };
      this.host.canvas.setPointerCapture(e.pointerId);
      return;
    }
    // Click-based author tools own their press, including on existing grips/markers.
    if (this.pointToolActive()) return;
    const pathHandle = this.host.camera.hitAt(e, ['atlasPathVertex', 'atlasPathInsert']);
    const pathElement = atlasDrawingDraft().element;
    if (
      pathHandle &&
      pathElement?.kind === 'path' &&
      pathElement.id === this.selection?.id &&
      pathElement.id === pathHandle.data.id
    ) {
      this.pathDrag = {
        id: e.pointerId,
        token: this.host.owner?.token,
        element: structuredClone(pathElement),
        index: Number(pathHandle.data.atlasPathVertex ?? pathHandle.data.atlasPathInsert),
        insert: pathHandle.data.atlasPathInsert !== undefined,
        point: atlasToLocal(this.host.point(e), this.host.frame(pathElement.scopeId)),
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };
      this.host.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      this.host.canvas.focus();
      return;
    }
    const hit = this.host.camera.hitAt(e, ['atlasObject']);
    if (hit?.data.kind === 'party') {
      this.partyDrag = {
        id: e.pointerId,
        start: this.host.point(e),
        last: this.host.point(e),
      };
      this.host.canvas.setPointerCapture(e.pointerId);
      return;
    }
    const handle = this.host.camera.hitAt(e, ['atlasVertex', 'atlasEdge']);
    if (handle && this.host.regions.data) {
      const selected = this.host.opts.roomDraft();
      const room = selected?.id === handle.data.id ? selected : null;
      if (room) {
        this.vertexDrag = {
          id: e.pointerId,
          room: structuredClone(room),
          polygon: Number(handle.data.polygon),
          vertex: Number(handle.data.atlasVertex ?? handle.data.atlasEdge),
          edge: handle.data.atlasEdge !== undefined,
          start: atlasDrawingSnapPoint(
            atlasToLocal(this.host.point(e), this.host.frame(room.scopeId)),
          ),
          point: atlasDrawingSnapPoint(
            atlasToLocal(this.host.point(e), this.host.frame(room.scopeId)),
          ),
        };
        this.host.canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
    const target = this.host.camera.hitAt(e, ['atlasObject']);
    if (
      this.host.regions.geometryCurrent() &&
      this.host.family === 'navigation' &&
      target?.data.kind === 'building'
    ) {
      this.drag = {
        id: e.pointerId,
        start: this.host.point(e),
        last: this.host.point(e),
        selection: {
          kind: 'building',
          id: target.data.id!,
          cityId: target.data.cityId!,
        },
      };
      this.host.canvas.setPointerCapture(e.pointerId);
    }
  }
  move(e: PointerEvent) {
    this.measurementHover = this.host.point(e);
    if (!this.host.output.exportOpen) this.host.camera.redrawOverlay();
    if (this.pathDrag?.id === e.pointerId) {
      this.pathDrag.point = atlasDrawingSnapPoint(
        atlasToLocal(this.host.point(e), this.host.frame(this.pathDrag.element.scopeId)),
      );
      this.pathDrag.moved ||=
        Math.hypot(e.clientX - this.pathDrag.x, e.clientY - this.pathDrag.y) >= 4;
      this.host.render();
      return;
    }
    if (this.host.output.moveArea(e, this.host.point(e))) return;
    if (this.roomDrag?.id === e.pointerId) {
      this.roomDrag.last = this.host.point(e);
      this.roomDrag.moved ||=
        Math.hypot(e.clientX - this.roomDrag.x, e.clientY - this.roomDrag.y) >= 4;
      this.host.render();
      return;
    }
    if (this.brushId === e.pointerId) {
      this.queueBrush(this.host.point(e));
      return;
    }
    if (this.partyDrag?.id === e.pointerId) {
      this.partyDrag.last = this.host.point(e);
      this.host.render();
    } else if (this.vertexDrag?.id === e.pointerId) {
      this.vertexDrag.point = atlasDrawingSnapPoint(
        atlasToLocal(this.host.point(e), this.host.frame(this.vertexDrag.room.scopeId)),
      );
      this.host.render();
    } else if (this.drag?.id === e.pointerId) {
      this.drag.last = this.host.point(e);
      this.host.render();
    }
  }
  async up(e: PointerEvent) {
    if (
      this.host.output.exportDrag?.id === e.pointerId &&
      this.host.output.endArea(e, this.host.point(e))
    ) {
      this.suppressClick();
      return;
    }
    if (
      !this.host.regions.geometryCurrent() &&
      (this.pathDrag || this.vertexDrag || this.drag || this.roomDrag || this.brushId !== null)
    ) {
      this.host.cancel();
      this.host.opts.status(
        'Kartengeometrie inzwischen geändert. Zug nach dem Laden erneut beginnen.',
        true,
      );
      return;
    }
    if (this.pathDrag?.id === e.pointerId) {
      const drag = this.pathDrag,
        element = atlasPathPreview(drag.element, drag);
      this.pathDrag = null;
      this.suppressClick();
      if (
        drag.token !== this.host.owner?.token ||
        element.scopeId !== this.host.scopeId ||
        element.floorId !== this.host.floorId ||
        this.selection?.id !== element.id
      ) {
        this.host.render();
        return;
      }
      const prior = drag.element.points[drag.index];
      if (!drag.moved || (!drag.insert && prior?.x === drag.point.x && prior?.y === drag.point.y)) {
        this.host.render();
        return;
      }
      if (this.host.owner) {
        const result = await this.host.write(
          {
            kind: 'drawing',
            command: {
              commandId: crypto.randomUUID(),
              campaignId: this.host.owner.campaign.id,
              token: this.host.owner.token,
              action: { kind: 'element', element, expectedRevision: drag.element.revision },
            },
          },
          true,
        );
        if (result) await selectElement(element.id);
      }
      this.host.render();
      return;
    }
    if (this.roomDrag?.id === e.pointerId) {
      const drag = this.roomDrag;
      this.roomDrag = null;
      if (!drag.moved) return; // Leave a stationary press to the existing two-click path.
      this.suppressClick();
      if (
        drag.scopeId !== this.host.scopeId ||
        drag.floorId !== this.host.floorId ||
        this.host.root.dataset.roomDraw !== 'true'
      )
        return;
      const f = this.host.frame(drag.scopeId);
      this.draft = [
        atlasDrawingSnapPoint(atlasToLocal(drag.start, f)),
        atlasDrawingSnapPoint(atlasToLocal(this.host.point(e), f)),
      ];
      try {
        await this.createRoomRectangle();
      } catch (e) {
        this.host.error(e);
      }
      this.host.render();
      return;
    }
    if (this.brushId === e.pointerId) {
      this.brushId = null;
      this.suppressClick();
      await this.brushQueue;
      this.host.render();
      return;
    }
    if (this.partyDrag?.id === e.pointerId) {
      const p = this.partyDrag;
      this.partyDrag = null;
      if (Math.hypot(p.last.x - p.start.x, p.last.y - p.start.y) <= 0.05) return;
      if (this.host.owner && this.host.regions.data?.scene) {
        this.suppressClick();
        this.placeIntent = {
          point: p.last,
          token: this.host.owner.token,
          sceneId: this.host.regions.data.scene.scene.id,
          revision: this.host.regions.data.scene.position.revision,
          membership: this.host.regions.data.scene.scene.membershipRevision,
        };
        get<HTMLDialogElement>('atlas-place-confirm').showModal();
      }
      this.host.render();
      return;
    }
    if (this.vertexDrag?.id === e.pointerId) {
      const v = this.vertexDrag;
      const room = this.roomPreview(v.room);
      this.vertexDrag = null;
      this.suppressClick();
      if (room === v.room) {
        this.host.render();
        return;
      }
      if (this.host.owner)
        await this.host.write(
          {
            kind: 'drawing',
            command: {
              commandId: crypto.randomUUID(),
              campaignId: this.host.owner.campaign.id,
              token: this.host.owner.token,
              action: {
                kind: 'shape',
                roomId: room.id,
                expectedRevision: v.room.revision,
                polygons: room.polygons,
                preserveBoundaryAnchors: true,
              },
            },
          },
          true,
        );
      return;
    }
    const drag = this.drag;
    if (!drag || drag.id !== e.pointerId) return;
    this.drag = null;
    const delta = {
      x: drag.last.x - drag.start.x,
      y: drag.last.y - drag.start.y,
    };
    if (Math.hypot(delta.x, delta.y) < 0.01) return;
    this.suppressClick();
    const s = drag.selection;
    if (s?.kind === 'building' && this.host.regions.data && this.host.owner) {
      const owner = this.host.owner;
      const exact = await window.campaign.atlasCitySite(owner.token, s.cityId, s.id);
      if (this.host.owner !== owner) return;
      if (!exact.ok) throw new Error(exact.error);
      if (!exact.value.unit) throw new Error('Haus fehlt.');
      const city = { header: exact.value.header },
        unit = exact.value.unit,
        binding = this.host.regions.data.bindings.find(
          (b) => b.kind === 'city' && b.ownerId === s.cityId,
        )!,
        f = atlasFrame(this.host.regions.data, binding),
        a = atlasToLocal(drag.start, f),
        b = atlasToLocal(drag.last, f);
      await this.host.write({
        kind: 'city',
        command: {
          commandId: crypto.randomUUID(),
          campaignId: this.host.owner.campaign.id,
          token: this.host.owner.token,
          cityId: s.cityId,
          expectedRevision: city.header.revision,
          action: {
            kind: 'change',
            upsert: [
              {
                ...unit,
                protected: true,
                position: {
                  x: unit.position!.x + b.x - a.x,
                  y: unit.position!.y + b.y - a.y,
                },
              },
            ],
            remove: [],
            label: 'Haus mit Innenräumen verschieben',
          },
        },
      });
    }
  }
}
