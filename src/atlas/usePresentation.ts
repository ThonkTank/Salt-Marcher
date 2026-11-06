import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  PresentationLoader,
  type PresentationInput,
  type LayerCommands,
} from "./presentationLoader";
export type { Presentation } from "./presentationLoader";

export function usePresentation(input: PresentationInput) {
  const [loader] = useState(() => new PresentationLoader());
  const snapshot = useSyncExternalStore(
    loader.subscribe,
    loader.getSnapshot,
    loader.getSnapshot,
  );
  useLayoutEffect(() => loader.update(input));
  useLayoutEffect(() => loader.dispose, [loader]);
  return {
    loader,
    value: snapshot.display?.value ?? null,
    error: snapshot.error,
    loading: snapshot.loading,
    retry: loader.retry,
    fresh: loader.fresh(input),
  };
}

export function usePresentationLayer<K extends keyof LayerCommands>(
  loader: PresentationLoader,
  name: K,
  client: import("./client").AtlasClient,
  args: import("./client").ReadCommands[LayerCommands[K]]["args"] | null,
) {
  const layer = loader.layer(name);
  const snapshot = useSyncExternalStore(
    loader.subscribe,
    () => layer.snapshot,
    () => layer.snapshot,
  );
  useLayoutEffect(() => layer.update(client, args));
  return {
    ...snapshot,
    fresh: layer.fresh(client, args),
    retry: () => {
      layer.invalidate();
      layer.update(client, args);
    },
  };
}
