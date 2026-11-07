import { GroundCache } from "./presentationCache";
import type { GroundResponse } from "./generated/GroundResponse";
import { terrainCacheFor, CityCache } from "./presentationCache";
import type { TerrainResponse } from "./generated/TerrainResponse";
import { cityRequest, type CityView } from "./cityView";
import { terrainRequest } from "./terrainView";
import { groundRequest } from "./groundView";
import type { AtlasClient, ReadCommands } from "./client";
import { TileCache, tileKey } from "./tileCache";
import { DetailAggregate } from "./detailAggregate";
import {
  interiorBounds,
  interiorTiles,
  toWorld,
  type EditorContext,
  type Status,
  type Scene,
  type Detail,
  type DetailTile,
  type Bounds,
  type House,
} from "./model";
import { contextKey, polygonBounds } from "./parcelEditor";
import { sameVersion, incrementalChanges } from "./documentVersion";
import { scheduledRead } from "./readScheduler";
export type Presentation = {
  terrain?: TerrainResponse;
  ground?: GroundResponse;
  overview?: CityView;
  scene: Scene;
  detail: Detail | null;
  active: string; // resolved house owner, never inferred from viewport
  context: EditorContext;
  selectedId: string;
  floor: number;
  bounds: Bounds;
  includeLower: boolean;
};
const inside = (a: Bounds, b: Bounds) =>
  a[0] >= b[0] && a[1] >= b[1] && a[2] <= b[2] && a[3] <= b[3];
const intersects = (a: Bounds, b: Bounds) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
// Match the backend's house bounds, including its point fallback for a house
// without roof contours. Pad for differences in JavaScript/Rust trig rounding.
const houseBounds = (house: House): Bounds => {
  const b: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of house.contours)
    for (const point of ring) {
      const [x, y] = toWorld(point, house.transform);
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    }
  if (!b.every(Number.isFinite))
    return [
      house.transform.x,
      house.transform.y,
      house.transform.x,
      house.transform.y,
    ];
  const pad = 1e-6 + Math.max(...b.map(Math.abs)) * 1e-12;
  return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
};
// Viewport changes share a context; navigation between contexts never shares ownership.
type LoadContext = {
  terrainLevel?: number;
  groundLevel?: number;
  client: AtlasClient;
  session: string | undefined;
  revision: number | undefined;
  editor: string;
  selectedId: string;
  floor: number;
  lower: boolean;
  enabled: boolean;
  cityLevel: number | null;
  retry: number;
};
const sameLoadContext = (a: LoadContext, b: LoadContext) =>
  a.client === b.client &&
  a.session === b.session &&
  a.revision === b.revision &&
  a.editor === b.editor &&
  a.selectedId === b.selectedId &&
  a.floor === b.floor &&
  a.lower === b.lower &&
  a.enabled === b.enabled &&
  (a.cityLevel === null) === (b.cityLevel === null) &&
  a.retry === b.retry;
type LoadRequest = {
  id: number;
  context: LoadContext;
  owner: number;
  tilesOwner: symbol;
};
type Published = {
  value: Presentation;
  request: LoadRequest;
  interim: boolean;
  placeholder?: boolean;
};

export type PresentationInput = {
  terrainScale?: number;
  terrainDpr?: number;
  terrainLevel?: number;
  groundLevel?: number;
  cityLevel?: number | null;
  client: AtlasClient;
  status: Status | null;
  bounds: Bounds;
  editorContext: EditorContext;
  selectedId: string;
  floor: number;
  detailEnabled: boolean;
  includeLower: boolean;
};
type Snapshot = { display: Published | null; error: string; loading: boolean };
const loadContext = (input: PresentationInput, retry: number): LoadContext => ({
  terrainLevel: input.terrainLevel,
  groundLevel: input.groundLevel,
  cityLevel: input.cityLevel ?? null,
  client: input.client,
  session: input.status?.sessionId,
  revision: input.status?.revision,
  editor: contextKey(input.editorContext),
  selectedId: input.selectedId,
  floor: input.floor,
  lower: input.includeLower,
  enabled: input.editorContext.kind === "exterior" || input.detailEnabled,
  retry,
});

const editorContextCity = (input: PresentationInput) =>
  input.editorContext.kind === "exterior" ? input.cityLevel : null;

export type LayerCommands = {
  rivers: "rivers";
  regionCatalog: "regions";
  regions: "regions";
};
type LayerSnapshot<T> = {
  value: T | null;
  error: string;
  key: string;
  loading: boolean;
};
// All independent reads share the same request ownership and retry lifecycle.
class PresentationLayer<
  A extends { version: { sessionId: string; revision: number } },
  T extends { status: Status },
> {
  snapshot: LayerSnapshot<T> = {
    value: null,
    error: "",
    key: "",
    loading: false,
  };
  private generation = 0;
  private client: AtlasClient | null = null;
  private requested = "";
  private requestArgs: A | null = null;
  private completeArgs: A | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private load: (
      client: AtlasClient,
      args: A,
      wanted: () => boolean,
    ) => Promise<T | null | undefined>,
    private publish: () => void,
    private covers: (a: A, b: A, value: T | null) => boolean = (a, b) =>
      JSON.stringify(a) === JSON.stringify(b),
    private debounceViewport = false,
  ) {}
  fresh(client: AtlasClient, args: A | null) {
    return (
      !!args &&
      !!this.requested &&
      this.client === client &&
      !!this.completeArgs &&
      this.covers(this.completeArgs, args, this.snapshot.value) &&
      !this.snapshot.loading &&
      !this.snapshot.error
    );
  }
  cancel() {
    this.generation++;
    this.requested = "";
    this.requestArgs = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
  invalidate() {
    this.cancel();
    this.completeArgs = null;
  }
  update(client: AtlasClient, args: A | null) {
    const key = JSON.stringify(args);
    if (this.client === client && this.requested === key) return;
    if (
      this.client === client &&
      args &&
      this.requestArgs &&
      this.snapshot.loading &&
      this.covers(this.requestArgs, args, null)
    )
      return;
    const changedClient = this.client !== client;
    const previousRequest = this.requestArgs;
    this.cancel();
    this.client = client;
    this.requested = key;
    this.requestArgs = args;
    const generation = this.generation;
    const current = () => generation === this.generation;
    const value =
      !changedClient &&
      (!args ||
        this.snapshot.value?.status.sessionId === args.version.sessionId)
        ? this.snapshot.value
        : null;
    if (!value) this.completeArgs = null;
    if (
      args &&
      value &&
      this.completeArgs &&
      this.covers(this.completeArgs, args, value)
    ) {
      this.snapshot = { value, error: "", key, loading: false };
      this.publish();
      return;
    }
    this.snapshot = { value, error: "", key: "", loading: !!args };
    this.publish();
    if (!args) return;
    const run = () => {
      this.timer = undefined;
      if (!current()) return;
      void this.load(client, args, current)
        .then((result) => {
          if (!current() || !result) return;
          if (!sameVersion(result.status, args.version))
            throw Error("Dokumentstand geändert. Bitte erneut laden.");
          this.completeArgs = args;
          this.snapshot = { value: result, error: "", key, loading: false };
          this.publish();
        })
        .catch((error) => {
          if (!current()) return;
          this.snapshot = {
            ...this.snapshot,
            error: String(error),
            loading: false,
          };
          this.publish();
        });
    };
    if (
      this.debounceViewport &&
      !changedClient &&
      previousRequest &&
      sameNavigationOptions(previousRequest, args)
    )
      this.timer = setTimeout(run, 50);
    else run();
  }
}
// Exact queries have no result cap. Overview coverage is reusable only when
// its response proves that no viewport-prioritized entries were truncated.
function sameViewportOptions(a: object, b: object) {
  const { bounds: _a, ...left } = a as { bounds?: Bounds };
  const { bounds: _b, ...right } = b as { bounds?: Bounds };
  return JSON.stringify(left) === JSON.stringify(right);
}
function sameNavigationOptions(a: object, b: object) {
  const {
    bounds: _a,
    scale: _as,
    overviewScale: _ao,
    ...left
  } = a as { bounds?: Bounds; scale?: number; overviewScale?: number };
  const {
    bounds: _b,
    scale: _bs,
    overviewScale: _bo,
    ...right
  } = b as { bounds?: Bounds; scale?: number; overviewScale?: number };
  return JSON.stringify(left) === JSON.stringify(right);
}
function viewportCovers<A extends { bounds: Bounds | null }>(
  a: A,
  b: A,
  complete: boolean,
) {
  return (
    complete &&
    !!a.bounds &&
    !!b.bounds &&
    inside(b.bounds, a.bounds) &&
    sameViewportOptions(a, b)
  );
}
type CommandLayer<K extends keyof LayerCommands> = PresentationLayer<
  ReadCommands[LayerCommands[K]]["args"],
  ReadCommands[LayerCommands[K]]["result"]
>;
type RasterArgs = {
  version: Status;
  bounds: Bounds;
  level: number;
  scale?: number;
  dpr?: number;
};
// Bounds-based tile budgets may change the effective resolution even when the
// requested level is unchanged. Reuse only if both requests choose the same level.
const rasterCovers =
  (request: (bounds: Bounds, level: number) => { level: number }) =>
  (a: RasterArgs, b: RasterArgs) =>
    viewportCovers(a, b, true) &&
    request(a.bounds, a.level).level === request(b.bounds, b.level).level;

/** Owns reads, cache lifetime and the single published snapshot; independent of React. */
export class PresentationLoader {
  private ground = new GroundCache();
  private city = new CityCache();
  private layers = {
    rivers: new PresentationLayer(
      (client, args: ReadCommands["rivers"]["args"], wanted) =>
        scheduledRead(client, "rivers", args, wanted),
      () => this.notify(),
      (a, b, value) =>
        JSON.stringify(a) === JSON.stringify(b) ||
        viewportCovers(
          a,
          b,
          a.overviewScale === undefined ||
            (!!value && value.rivers.length < 128),
        ),
      true,
    ),
    regionCatalog: new PresentationLayer(
      (client, args: ReadCommands["regions"]["args"], wanted) =>
        scheduledRead(client, "regions", args, wanted),
      () => this.notify(),
    ),
    regions: new PresentationLayer(
      (client, args: ReadCommands["regions"]["args"], wanted) =>
        scheduledRead(client, "regions", args, wanted),
      () => this.notify(),
      (a, b, value) =>
        JSON.stringify(a) === JSON.stringify(b) ||
        viewportCovers(
          a,
          b,
          a.exact || (!!value && value.regions.length < 1000),
        ),
      true,
    ),
    terrain: new PresentationLayer(
      (client, args: RasterArgs, wanted) =>
        terrainCacheFor(client).load(
          client,
          args.version,
          args.bounds,
          args.level,
          wanted,
          args.scale,
          args.dpr,
        ),
      () => this.refreshLayers(),
      (a, b) =>
        rasterCovers(terrainRequest)(a, b) &&
        terrainRequest(a.bounds, a.level, a.scale, a.dpr).pixels ===
          terrainRequest(b.bounds, b.level, b.scale, b.dpr).pixels &&
        terrainRequest(a.bounds, a.level, a.scale, a.dpr).contourInterval ===
          terrainRequest(b.bounds, b.level, b.scale, b.dpr).contourInterval,
      true,
    ),
    ground: new PresentationLayer(
      (client, args: RasterArgs, wanted) =>
        this.ground.load(client, args.version, args.bounds, args.level, wanted),
      () => this.refreshLayers(),
      rasterCovers(groundRequest),
      true,
    ),
    city: new PresentationLayer(
      (client, args: RasterArgs, wanted) =>
        this.city.load(client, args.version, args.bounds, args.level, wanted),
      () => this.refreshLayers(),
      rasterCovers(cityRequest),
      true,
    ),
  };
  private notify() {
    for (const listener of this.listeners) listener();
  }
  layer<K extends keyof LayerCommands>(name: K): CommandLayer<K> {
    return this.layers[name] as unknown as CommandLayer<K>;
  }
  private refreshLayers() {
    const display = this.snapshot.display;
    if (!display) {
      this.updateSnapshot({});
      return;
    }
    const terrain =
      this.committed?.input.terrainLevel == null
        ? undefined
        : (this.layers.terrain.snapshot.value ?? undefined);
    const candidate =
      this.committed?.input.groundLevel == null
        ? undefined
        : (this.layers.ground.snapshot.value ?? undefined);
    const ground =
      candidate &&
      (this.committed?.input.terrainLevel == null ||
        (terrain && sameVersion(candidate.status, terrain.status)))
        ? candidate
        : undefined;
    const overview =
      this.committed?.context.cityLevel != null
        ? (this.layers.city.snapshot.value ?? undefined)
        : undefined;
    if (
      terrain !== display.value.terrain ||
      ground !== display.value.ground ||
      overview !== display.value.overview
    ) {
      const value = { ...display.value, terrain, ground, overview };
      this.updateSnapshot({ display: { ...display, value } });
    } else {
      this.updateSnapshot({});
    }
  }
  private snapshot: Snapshot = { display: null, error: "", loading: false };
  private sceneError = "";
  private sceneLoading = false;
  private listeners = new Set<() => void>();
  private tiles = new TileCache();
  private aggregate = new DetailAggregate();
  private sequence = 0;
  private generation = 0;
  private retries = 0;
  private request: LoadRequest | null = null;
  private committed: {
    input: PresentationInput;
    context: LoadContext;
    key: string;
  } | null = null;

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private updateSnapshot(patch: Partial<Snapshot>) {
    if (patch.error !== undefined) this.sceneError = patch.error;
    if (patch.loading !== undefined) this.sceneLoading = patch.loading;
    const layers = [
      this.layers.terrain.snapshot,
      this.layers.ground.snapshot,
      this.layers.city.snapshot,
    ];
    const next = {
      ...this.snapshot,
      ...patch,
      error:
        this.sceneError ||
        layers.map((layer) => layer.error).find(Boolean) ||
        "",
      loading: this.sceneLoading || layers.some((layer) => layer.loading),
    };
    if (
      next.display === this.snapshot.display &&
      next.error === this.snapshot.error &&
      next.loading === this.snapshot.loading
    )
      return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
  dispose = () => {
    this.generation++;
    for (const layer of Object.values(this.layers)) layer.cancel();
    if (this.request) this.tiles.release(this.request.tilesOwner);
    this.request = null;
  };
  retry = () => {
    this.retries++;
    this.layers.terrain.invalidate();
    this.layers.ground.invalidate();
    this.layers.city.invalidate();
    if (this.committed) this.update(this.committed.input);
  };
  fresh(input: PresentationInput) {
    const { display, error, loading } = this.snapshot;
    return (
      !!input.status &&
      !!display &&
      !display.placeholder &&
      sameLoadContext(
        display.request.context,
        loadContext(input, this.retries),
      ) &&
      display.request.owner === this.generation &&
      inside(input.bounds, display.value.bounds) &&
      (!loading || display.interim) &&
      !error &&
      this.rastersFresh(input)
    );
  }
  private rastersFresh(input: PresentationInput) {
    const committed = this.committed;
    if (!input.status || !committed) return false;
    const bounds = JSON.parse(committed.key) as Bounds;
    if (!inside(input.bounds, bounds)) return false;
    const args = (level: number | null | undefined): RasterArgs | null =>
      level == null ? null : { version: input.status!, bounds, level };
    return (
      (input.terrainLevel == null ||
        this.layers.terrain.fresh(input.client, {
          ...args(input.terrainLevel)!,
          dpr: input.terrainDpr,
          scale: input.terrainScale,
        })) &&
      (input.groundLevel == null ||
        this.layers.ground.fresh(input.client, args(input.groundLevel))) &&
      (editorContextCity(input) == null ||
        this.layers.city.fresh(input.client, args(editorContextCity(input))))
    );
  }
  // Called only with committed UI inputs, never during a speculative React render.
  update(input: PresentationInput) {
    const { client, status, bounds, detailEnabled } = input;
    const context = loadContext(input, this.retries);
    const prior = this.committed;
    const changed = !prior || !sameLoadContext(prior.context, context);
    if (changed) this.generation++;
    const queryBounds: Bounds = [
      Math.floor(bounds[0] / 20) * 20 - 20,
      Math.floor(bounds[1] / 20) * 20 - 20,
      Math.ceil(bounds[2] / 20) * 20 + 20,
      Math.ceil(bounds[3] / 20) * 20 + 20,
    ];
    const key = JSON.stringify(queryBounds);
    this.committed = { input, context, key };
    const raster = (level: number | null | undefined): RasterArgs | null =>
      status && level != null
        ? { version: status, bounds: queryBounds, level }
        : null;
    const terrainArgs = raster(input.terrainLevel);
    this.layers.terrain.update(
      client,
      terrainArgs
        ? { ...terrainArgs, dpr: input.terrainDpr, scale: input.terrainScale }
        : null,
    );
    this.layers.ground.update(client, raster(input.groundLevel));
    this.layers.city.update(client, raster(editorContextCity(input)));
    if (
      !changed &&
      prior.key === key &&
      prior.input.detailEnabled === detailEnabled &&
      this.request
    )
      return;
    if (this.request) this.tiles.release(this.request.tilesOwner);
    this.request = null;
    if (!status || prior?.input.client !== client) {
      this.tiles.setContext(null);
      this.aggregate.clear();
    }
    if (!status) {
      this.updateSnapshot({ display: null, error: "", loading: false });
      return;
    }
    const request: LoadRequest = {
      id: ++this.sequence,
      context,
      owner: this.generation,
      tilesOwner: Symbol(),
    };
    this.request = request;
    const display = this.snapshot.display;
    const previous =
      display &&
      !display.placeholder &&
      display.request.context.client === client &&
      display.request.context.session === status.sessionId &&
      display.request.context.retry === this.retries
        ? display.value
        : null;
    this.updateSnapshot({
      loading: true,
      display:
        display?.request.context.client !== client ||
        display?.value.scene.status.sessionId !== status.sessionId
          ? null
          : display,
    });
    if (
      !this.snapshot.display &&
      (input.terrainLevel != null ||
        input.groundLevel != null ||
        editorContextCity(input) != null)
    ) {
      const emptyOwner = { exists: false, houseId: null, parcelId: null };
      this.updateSnapshot({
        display: {
          request,
          interim: false,
          placeholder: true,
          value: {
            scene: {
              status,
              objects: [],
              contextState: emptyOwner,
              selectionState: emptyOwner,
            },
            detail: null,
            active: "",
            context: input.editorContext,
            selectedId: input.selectedId,
            floor: input.floor,
            bounds: queryBounds,
            includeLower: input.includeLower,
          },
        },
      });
      this.refreshLayers();
    }
    void this.load(
      input,
      status,
      request,
      queryBounds,
      previous,
      !!display && display.request.context.cityLevel === null,
    );
  }
  private async load(
    input: PresentationInput,
    status: Status,
    request: LoadRequest,
    queryBounds: Bounds,
    previous: Presentation | null,
    previousExact: boolean,
  ) {
    const {
      client,
      editorContext,
      selectedId,
      floor,
      detailEnabled,
      includeLower,
    } = input;
    const active = request.context.editor;
    const owner = request.tilesOwner;
    const context = {
      session: status.sessionId,
      revision: status.revision,
      house: "",
      editor: active,
      selectedId,
      floor,
      lower: includeLower,
      retry: request.context.retry,
      enabled: detailEnabled,
    };
    const sameContext = () => this.generation === request.owner;
    const current = () => sameContext() && this.request === request;
    const publish = (value: Presentation, interim: boolean) => {
      if (
        !this.snapshot.display ||
        request.id > this.snapshot.display.request.id ||
        (request.id === this.snapshot.display.request.id &&
          this.snapshot.display.placeholder)
      ) {
        this.updateSnapshot({ display: { value, request, interim } });
        this.refreshLayers();
      }
    };
    const read = <K extends keyof ReadCommands>(
      cmd: K,
      args: ReadCommands[K]["args"],
      wanted: () => boolean = () => this.request === request,
    ) => scheduledRead(client, cmd, args, wanted);
    try {
      if (input.cityLevel != null && editorContext.kind === "exterior") {
        const emptyOwner = { exists: true, houseId: null, parcelId: null };
        const priorSelected = previous?.scene.objects.find(
          (object) => object.id === selectedId,
        );
        const scene = selectedId
          ? priorSelected && priorSelected.kind !== "road"
            ? await read("objectHeader", { id: selectedId })
            : await read("roadHeader", { roadId: selectedId })
          : {
              status,
              objects: [],
              contextState: emptyOwner,
              selectionState: emptyOwner,
            };
        if (!scene || !current()) return;
        if (!sameVersion(scene.status, status))
          throw Error("Kartenstand hat sich geändert. Bitte erneut laden.");
        publish(
          {
            scene,
            terrain: undefined,
            ground: undefined,
            overview: undefined,
            detail: null,
            active: "",
            context: editorContext,
            selectedId,
            floor,
            bounds: queryBounds,
            includeLower,
          },
          false,
        );
        this.updateSnapshot({ error: "" });
        return;
      }
      const prior = previous?.scene.status;
      const unchanged = sameVersion(prior, status);
      const changes = incrementalChanges(prior ?? null, status);
      const next = !!changes;
      // All forced closure headers participate, including offscreen owners.
      // Missing targets must be rechecked on undo, even outside queryBounds.
      const closureIds = previous
        ? new Set(
            [
              selectedId,
              editorContext.kind === "house"
                ? editorContext.houseId
                : editorContext.kind === "parcel"
                  ? editorContext.parcelId
                  : "",
              previous.scene.contextState.parcelId,
              previous.scene.contextState.houseId,
              previous.scene.selectionState.parcelId,
              previous.scene.selectionState.houseId,
            ].filter((id): id is string => !!id),
          )
        : new Set<string>();
      const closureUnaffected =
        previous &&
        changes &&
        !changes.relations.some((id) => closureIds.has(id)) &&
        [...closureIds].every((id) => {
          const object = previous.scene.objects.find((o) => o.id === id);
          if (!object) return changes.world.length === 0;
          let b: Bounds;
          if (object.kind === "house") b = houseBounds(object);
          else {
            const points =
              object.kind === "parcel"
                ? object.polygon
                : object.kind === "area"
                  ? object.points
                  : object.kind === "scenery"
                    ? object.assets.flatMap(
                        (asset) =>
                          [
                            [
                              asset.point[0] - asset.size,
                              asset.point[1] - asset.size,
                            ],
                            [
                              asset.point[0] + asset.size,
                              asset.point[1] + asset.size,
                            ],
                          ] as [number, number][],
                      )
                    : object.path;
            if (!points.length) return changes.world.length === 0;
            b = polygonBounds(points)!;
          }
          return !changes.world.some((world) => intersects(world, b));
        });
      // Clearing selection needs no new owner header. Only an unchanged exact
      // exterior scene can provide this local transition; other selections read.
      const clearSelection =
        editorContext.kind === "exterior" &&
        selectedId === "" &&
        !!previous?.selectedId &&
        unchanged;
      const sceneReusable =
        previous &&
        // Layer projection may already have removed the old overview image.
        // The published request, not that image, proves scene completeness.
        previousExact &&
        contextKey(previous.context) === active &&
        (previous.selectedId === selectedId || clearSelection) &&
        inside(queryBounds, previous.bounds) &&
        (unchanged ||
          (next &&
            closureUnaffected &&
            !changes!.world.some((b) => intersects(b, previous.bounds))));
      const scene = sceneReusable
        ? {
            ...previous!.scene,
            status,
            selectionState: clearSelection
              ? { exists: true, houseId: null, parcelId: null }
              : previous!.scene.selectionState,
          }
        : await read("scene", {
            bounds: queryBounds,
            context: editorContext,
            selectedId: selectedId || undefined,
          });
      if (!scene) return;
      if (!current()) {
        // A completed exterior scene can advance the displayed view while a
        // newer margin read continues. Its actual requested bounds and
        // response version must still cover the committed current context.
        if (
          !sceneReusable &&
          editorContext.kind === "exterior" &&
          sameContext() &&
          !this.snapshot.error &&
          sameVersion(scene.status, status) &&
          inside(this.committed!.input.bounds, queryBounds)
        ) {
          publish(
            {
              scene,
              terrain: undefined,
              ground: undefined,
              detail: null,
              active: "",
              context: editorContext,
              selectedId,
              floor,
              bounds: queryBounds,
              includeLower,
            },
            true,
          );
        }
        return;
      }
      if (!sameVersion(scene.status, status))
        throw Error(
          "Dokumentstand hat sich während des Ladens geändert. Bitte erneut laden.",
        );
      const fulfilled = sceneReusable ? previous!.bounds : queryBounds;
      let detail: Detail | null = null;
      const houseId = scene.contextState.houseId ?? "";
      context.house = houseId;
      this.tiles.setContext(context, status);
      const house = scene.objects.find(
        (o): o is House => o.kind === "house" && o.id === houseId,
      );
      if (house && detailEnabled) {
        const localBounds = interiorBounds(queryBounds, house.transform);
        const old = previous?.detail;
        const metadataReusable =
          previous &&
          old &&
          old.buildingId === houseId &&
          previous.selectedId === selectedId &&
          contextKey(previous.context) === active &&
          (unchanged || (next && !changes!.metadata.includes(houseId)));
        const metadata = metadataReusable
          ? {
              status,
              buildingId: houseId,
              rooms: old.rooms,
              connections: old.connections,
            }
          : await read("interiorMetadata", { buildingId: houseId });
        if (!metadata || this.request !== request) return;
        if (
          !sameVersion(metadata.status, status) ||
          metadata.buildingId !== houseId
        )
          throw Error(
            "Dokumentstand hat sich während des Ladens geändert. Bitte erneut laden.",
          );
        const tiles = interiorTiles(localBounds);
        const parts: DetailTile[] = new Array(tiles.length);
        let nextTile = 0;
        let failed = false;
        const results = await Promise.allSettled(
          Array.from({ length: Math.min(4, tiles.length) }, async () => {
            while (
              !failed &&
              this.request === request &&
              nextTile < tiles.length
            ) {
              const index = nextTile++;
              try {
                const tile = tiles[index];
                const part = await this.tiles.get(
                  context,
                  tile.x,
                  tile.y,
                  owner,
                  (wanted) =>
                    read(
                      "interiorTile",
                      {
                        buildingId: houseId,
                        floor,
                        bounds: tile.core,
                        includeLower,
                      },
                      wanted,
                    ),
                  (part) =>
                    sameVersion(part.status, status) &&
                    part.buildingId === houseId &&
                    part.floor === floor &&
                    part.includeLower === includeLower &&
                    part.bounds.length === tile.core.length &&
                    part.bounds.every((v, i) => v === tile.core[i]),
                );
                if (part) parts[index] = part;
              } catch (error) {
                failed = true;
                throw error;
              }
            }
          }),
        );
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
        if (this.request !== request) return;
        if (
          parts.filter(Boolean).length !== tiles.length ||
          parts.some(
            (part, index) =>
              !sameVersion(part.status, status) ||
              part.buildingId !== houseId ||
              part.floor !== floor ||
              part.includeLower !== includeLower ||
              part.bounds.some((v, i) => v !== tiles[index].core[i]),
          )
        )
          throw Error(
            "Dokumentstand hat sich während des Ladens geändert. Bitte erneut laden.",
          );
        detail = this.aggregate.get(
          tiles.map((tile) => tileKey(context, tile.x, tile.y)),
          parts,
          metadata,
        );
      } else {
        this.aggregate.clear();
      }
      if (!current()) return;
      const result = {
        terrain: undefined,
        ground: undefined,
        scene,
        detail,
        active: houseId,
        context: editorContext,
        selectedId,
        floor,
        bounds: fulfilled,
        includeLower,
      };
      publish(result, false);
      this.updateSnapshot({ error: "" });
    } catch (error) {
      if (current()) this.updateSnapshot({ error: String(error) });
    } finally {
      if (current()) this.updateSnapshot({ loading: false });
    }
  }
}
