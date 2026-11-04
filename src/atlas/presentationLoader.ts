import { CityCache, type CityView } from "./cityView";
import type { AtlasClient, ReadCommands } from "./client";
import { knownChanges, TileCache, tileKey } from "./tileCache";
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
import { sameVersion } from "./documentVersion";
import { scheduledRead } from "./readScheduler";
export type Presentation = {
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
  a.cityLevel === b.cityLevel &&
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
};

export type PresentationInput = {
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

/** Owns reads, cache lifetime and the single published snapshot; independent of React. */
export class PresentationLoader {
  private city = new CityCache();
  private snapshot: Snapshot = { display: null, error: "", loading: false };
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
    const next = { ...this.snapshot, ...patch };
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
    if (this.request) this.tiles.release(this.request.tilesOwner);
    this.request = null;
  };
  retry = () => {
    this.retries++;
    if (this.committed) this.update(this.committed.input);
  };
  fresh(input: PresentationInput) {
    const { display, error, loading } = this.snapshot;
    return (
      !!input.status &&
      !!display &&
      sameLoadContext(
        display.request.context,
        loadContext(input, this.retries),
      ) &&
      display.request.owner === this.generation &&
      inside(input.bounds, display.value.bounds) &&
      (!loading || display.interim) &&
      !error
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
    if (!status) return;
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
      display.request.context.client === client &&
      display.request.context.session === status.sessionId &&
      display.request.context.retry === this.retries
        ? display.value
        : null;
    this.updateSnapshot({
      loading: true,
      display:
        display?.value.scene.status.sessionId !== status.sessionId
          ? null
          : display,
    });
    void this.load(input, status, request, queryBounds, previous);
  }
  private async load(
    input: PresentationInput,
    status: Status,
    request: LoadRequest,
    queryBounds: Bounds,
    previous: Presentation | null,
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
        request.id > this.snapshot.display.request.id
      )
        this.updateSnapshot({ display: { value, request, interim } });
    };
    const read = <K extends keyof ReadCommands>(
      cmd: K,
      args: ReadCommands[K]["args"],
      wanted: () => boolean = () => this.request === request,
    ) => scheduledRead(client, cmd, args, wanted);
    try {
      if (input.cityLevel != null && editorContext.kind === "exterior") {
        const overview = await this.city.load(
          client,
          status,
          queryBounds,
          input.cityLevel,
          current,
        );
        if (!overview || !current()) return;
        const emptyOwner = { exists: true, houseId: null, parcelId: null };
        const scene = selectedId
          ? await read("scene", {
              bounds: [5000100, 5000100, 5000100, 5000100],
              context: editorContext,
              selectedId,
            })
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
            overview,
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
      const unchanged = prior?.revision === status.revision;
      const changes = knownChanges(status);
      const next = prior?.revision === status.revision - 1 && !!changes;
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
                  : object.path;
            if (!points.length) return changes.world.length === 0;
            b = polygonBounds(points)!;
          }
          return !changes.world.some((world) => intersects(world, b));
        });
      const sceneReusable =
        previous &&
        !previous.overview &&
        contextKey(previous.context) === active &&
        previous.selectedId === selectedId &&
        inside(queryBounds, previous.bounds) &&
        (unchanged ||
          (next &&
            closureUnaffected &&
            !changes!.world.some((b) => intersects(b, previous.bounds))));
      const scene = sceneReusable
        ? { ...previous!.scene, status }
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
