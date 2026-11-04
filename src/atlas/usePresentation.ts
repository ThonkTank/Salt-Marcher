import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  PresentationLoader,
  type PresentationInput,
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
    value: snapshot.display?.value ?? null,
    error: snapshot.error,
    loading: snapshot.loading,
    retry: loader.retry,
    fresh: loader.fresh(input),
  };
}
