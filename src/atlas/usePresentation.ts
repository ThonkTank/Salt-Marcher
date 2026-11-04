import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { AtlasClient } from "./client";
import type { Bounds, EditorContext, Status } from "./model";
import { PresentationLoader } from "./presentationLoader";
export type { Presentation } from "./presentationLoader";

export function usePresentation(
  client: AtlasClient,
  status: Status | null,
  bounds: Bounds,
  editorContext: EditorContext,
  selectedId: string,
  floor: number,
  detailEnabled = true,
  includeLower = true,
  cityLevel: number | null = null,
) {
  const [loader] = useState(() => new PresentationLoader());
  const snapshot = useSyncExternalStore(
    loader.subscribe,
    loader.getSnapshot,
    loader.getSnapshot,
  );
  const input = {
    cityLevel,
    client,
    status,
    bounds,
    editorContext,
    selectedId,
    floor,
    detailEnabled,
    includeLower,
  };
  useLayoutEffect(() => loader.update(input));
  useLayoutEffect(() => loader.dispose, [loader]);
  return {
    value: snapshot.display?.value ?? null,
    error: snapshot.error,
    loading: snapshot.loading,
    retry: loader.retry,
    fresh: loader.fresh(input),
  };
}
