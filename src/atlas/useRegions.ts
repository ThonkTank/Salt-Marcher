import { useEffect, useMemo, useRef, useState } from "react";
import type { AtlasClient } from "./client";
import { usePresentationLayer } from "./usePresentation";
import type { PresentationLoader } from "./presentationLoader";
import { sameVersion } from "./documentVersion";
import type { Bounds, Camera, Intent, Status, WorldPoint } from "./model";
import type { RegionAction } from "./generated/RegionAction";
import type { Region } from "./generated/Region";
import type { RegionResponse } from "./generated/RegionResponse";
import type { RegionCatalog } from "./generated/RegionCatalog";
import { hitRegion, visibleRanks, displayedRegions } from "./regionView";
const emptyIds = Object.freeze([]) as unknown as string[];
const emptyRanks = Object.freeze([]) as unknown as RegionCatalog["ranks"];
const emptySummaries = Object.freeze(
  [],
) as unknown as RegionResponse["summaries"];
const emptyRegions = Object.freeze([]) as unknown as Region[];
const emptyRelations = Object.freeze(
  [],
) as unknown as RegionResponse["relations"];
export function useRegions(
  loader: PresentationLoader,
  client: AtlasClient,
  status: Status | null,
  bounds: Bounds,
  camera: Camera,
  { visible, active }: { visible: boolean; active: boolean },
  apply: (i: Intent) => unknown,
  cancel: () => void,
) {
  const [categoryId, setCategory] = useState("builtin-category-1"),
    [rankId, setRank] = useState("builtin-rank-3"),
    [selected, setSelected] = useState(""),
    [diameter, setDiameter] = useState(80),
    [mode, setMode] = useState<"paint" | "erase" | "select" | "label">("paint");
  const prior = useRef(new Map<string, string>());
  const priorSession = useRef(status?.sessionId);
  if (priorSession.current !== status?.sessionId) {
    prior.current.clear();
    priorSession.current = status?.sessionId;
  }
  const creating = useRef<{
    name: string;
    rankId: string;
    known: Set<string>;
  } | null>(null);
  useEffect(() => {
    creating.current = null;
    setSelected("");
    setCategory("builtin-category-1");
    setRank("builtin-rank-3");
  }, [status?.sessionId]);
  const catalogRead = usePresentationLayer(
    loader,
    "regionCatalog",
    client,
    visible && status
      ? {
          version: status,
          bounds: null,
          ids: [],
          rankIds: [],
          detail: null,
          exact: active,
          scale: 1,
        }
      : null,
  );
  const current =
    catalogRead.value?.status.sessionId === status?.sessionId
      ? catalogRead.value
      : null;
  const catalog = current?.catalog;
  const category =
    catalog?.categories.find((c) => c.id === categoryId) ??
    catalog?.categories[0];
  const ranks = useMemo(
    () =>
      catalog?.ranks.filter((r) => r.categoryId === category?.id) ?? emptyRanks,
    [catalog, category?.id],
  );
  const rank = ranks.find((r) => r.id === rankId) ?? ranks[0];
  const summaries = current?.summaries ?? emptySummaries;
  useEffect(() => {
    if (
      !visible ||
      !catalogRead.fresh ||
      !current ||
      !sameVersion(current.status, status)
    )
      return;
    const pending = creating.current;
    const created = pending
      ? summaries.find(
          (s) =>
            s.name === pending.name &&
            s.rankId === pending.rankId &&
            !pending.known.has(s.id),
        )
      : undefined;
    const item = created ?? summaries.find((s) => s.id === selected);
    if (item) {
      const rank = catalog?.ranks.find((r) => r.id === item.rankId);
      if (rank) {
        setCategory(rank.categoryId);
        setRank(rank.id);
      }
      if (created) {
        setSelected(created.id);
        creating.current = null;
      }
    }
  }, [current, visible, catalogRead.fresh]);
  const selection =
    summaries.find((s) => s.id === selected && s.rankId === rank?.id)?.id ?? "";
  const shownKey = JSON.stringify(
    useMemo(
      () =>
        visible && catalog
          ? visibleRanks(
              catalog,
              summaries,
              camera.scale,
              prior.current,
              active ? rank?.id : undefined,
            )
          : emptyIds,
      [
        visible,
        catalog,
        summaries,
        camera.scale,
        active,
        rank?.id,
        status?.sessionId,
      ],
    ),
  );
  const shown = useMemo(() => JSON.parse(shownKey) as string[], [shownKey]);
  const markerRanks = useMemo(
    () =>
      visible && catalog
        ? catalog.ranks
            .filter((r) =>
              catalog.categories.some(
                (c) => c.id === r.categoryId && c.markers,
              ),
            )
            .map((r) => r.id)
        : emptyIds,
    [visible, catalog],
  );
  const read = usePresentationLayer(
    loader,
    "regions",
    client,
    visible && status && catalogRead.fresh
      ? {
          version: status,
          bounds,
          rankIds: shown,
          ids: [],
          detail: active && selection ? selection : null,
          scale: camera.scale,
          exact: active,
        }
      : null,
  );
  const display =
    read.value?.status.sessionId === status?.sessionId ? read.value : null;
  const fresh = visible && catalogRead.fresh && read.fresh;
  const displayed = useMemo(
    () =>
      visible && display?.regions.length
        ? displayedRegions(display.regions, catalog, shown)
        : emptyRegions,
    [visible, display?.regions, catalog, shown],
  );
  const region = display?.regions.find((r) => r.id === selection);
  const action = (action: RegionAction) => {
    if (!fresh) return;
    creating.current =
      action.kind === "create"
        ? { ...action, known: new Set(summaries.map((s) => s.id)) }
        : null;
    cancel();
    apply({ type: "regionEdit", action });
  };
  const update = (patch: Partial<Region>) => {
    if (region && fresh) {
      const r = { ...region, ...patch };
      action({
        kind: "update",
        id: r.id,
        name: r.name,
        rankId: r.rankId,
        style: r.style,
        label: r.label,
      });
    }
  };
  const select = (id: string) => {
    cancel();
    const s = summaries.find((r) => r.id === id);
    if (s) {
      const rank = catalog?.ranks.find((r) => r.id === s.rankId);
      if (rank) {
        setCategory(rank.categoryId);
        setRank(rank.id);
      }
      setSelected(id);
    }
  };
  return {
    markerRanks,
    catalog: visible ? catalog : undefined,
    category: visible ? category : undefined,
    rank: visible ? rank : undefined,
    ranks: visible ? ranks : emptyRanks,
    summaries: visible ? summaries : emptySummaries,
    displaySummaries: visible
      ? (display?.summaries ?? summaries)
      : emptySummaries,
    region: visible ? region : undefined,
    selected: visible ? selection : "",
    diameter,
    mode,
    error: visible ? catalogRead.error || read.error : "",
    fresh,
    data: visible ? display : null,
    regions: displayed,
    relations: visible
      ? (display?.relations ?? emptyRelations)
      : emptyRelations,
    action,
    update,
    select,
    setDiameter,
    setMode: (m: typeof mode) => {
      cancel();
      setMode(m);
    },
    chooseCategory: (id: string) => {
      cancel();
      setCategory(id);
      setSelected("");
    },
    chooseRank: (id: string) => {
      cancel();
      setRank(id);
      setSelected("");
    },
    retry: () => {
      catalogRead.retry();
      read.retry();
    },
    pick: (p: WorldPoint, label: boolean) => {
      if (!fresh) return;
      if (label && region) update({ label: { ...region.label, anchor: p } });
      else {
        const hit = hitRegion(
          display?.regions.filter((r) => r.rankId === rank?.id) ?? [],
          p,
        );
        if (hit) select(hit.id);
      }
    },
  };
}
export type RegionsEditor = ReturnType<typeof useRegions>;
