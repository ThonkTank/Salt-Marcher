import { isTauri } from "@tauri-apps/api/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { AtlasClient } from "./client";
import {
  documentQueueFor,
  type DocumentKind,
  type SessionLease,
} from "./documentQueue";
import type { Intent, Version } from "./model";
import type { PlannedAction } from "./editorWorkflow";

type Choice = "save" | "discard" | "cancel";

/** React owns only this mount's confirmation, readiness and native/DOM binding. */
export function useDocumentSession(client: AtlasClient) {
  const queue = documentQueueFor(client);
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  const binding = useMemo(
    () => ({ lease: null as SessionLease | null }),
    [queue],
  );
  const [, renderReady] = useState(0);
  const [unsaved, setUnsaved] = useState<{
    unavailable: boolean;
    resolve: (choice: Choice) => void;
  } | null>(null);
  const confirmation = useRef<((choice: Choice) => void) | null>(null);
  const confirm = useCallback(
    (unavailable: boolean) =>
      new Promise<Choice>((resolve) => {
        const finish = (choice: Choice) => {
          if (confirmation.current !== finish) return;
          confirmation.current = null;
          setUnsaved(null);
          resolve(choice);
        };
        confirmation.current = finish;
        setUnsaved({ unavailable, resolve: finish });
      }),
    [],
  );
  useEffect(() => {
    const lease = queue.attach({ confirm });
    binding.lease = lease;
    void queue.ready(lease).then(() => {
      // A detach can run between the protocol result and this promise consumer.
      if (binding.lease === lease && queue.isReady(lease))
        renderReady((n) => n + 1);
    });
    return () => {
      queue.detach(lease);
      if (binding.lease === lease) binding.lease = null;
      confirmation.current?.("cancel");
    };
  }, [queue, binding, confirm]);
  const document = useCallback(
    async (kind: DocumentKind): Promise<void> => {
      const lease = binding.lease;
      if (!lease) return;
      const focus = window.document.activeElement as HTMLElement | null;
      const result = await queue.document(lease, kind);
      if (result === "finished")
        requestAnimationFrame(() => {
          if (!queue.getSnapshot().exclusive && focus?.isConnected)
            focus.focus();
        });
    },
    [queue, binding],
  );
  const latestDocument = useRef(document);
  latestDocument.current = document;
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      const current = queue.getSnapshot();
      if (current.status?.dirty || current.exclusive) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    if (!isTauri()) window.addEventListener("beforeunload", unload);
    let dispose: (() => void) | undefined,
      cancelled = false;
    void client
      .onCloseRequested(() => {
        void latestDocument.current("close");
      })
      .then((f) => {
        if (cancelled) f();
        else dispose = f;
      })
      .catch((error) => {
        if (!cancelled) queue.setError(String(error));
      });
    return () => {
      cancelled = true;
      dispose?.();
      window.removeEventListener("beforeunload", unload);
    };
  }, [client, queue]);
  const ready = binding.lease !== null && queue.isReady(binding.lease);
  const status = ready ? snapshot.status : null;
  useEffect(() => {
    window.document.title = `${status?.dirty ? "● " : ""}${status?.path?.split(/[\\/]/).pop() ?? "Unbenannter Atlas"} · SaltMarcher V7`;
  }, [status]);
  return {
    ...snapshot,
    status,
    unsaved,
    getGate: () =>
      binding.lease
        ? queue.getGate(binding.lease)
        : {
            version: null,
            pending: queue.getSnapshot().pending,
            exclusive: queue.getSnapshot().exclusive,
            uncertain: queue.getSnapshot().uncertain,
          },
    acknowledge: (version: Version) => queue.acknowledge(version),
    setError: (message: string) => queue.setError(message),
    beginTerrain: (intent: Extract<Intent, { type: "terrainStroke" }>) => {
      if (binding.lease) queue.beginTerrain(binding.lease, intent);
    },
    appendTerrain: (
      points: Extract<Intent, { type: "terrainStroke" }>["brush"]["points"],
      view: Extract<Intent, { type: "terrainStroke" }>["view"],
    ) => {
      if (binding.lease) queue.appendTerrain(binding.lease, points, view);
    },
    finishTerrain: queue.finishTerrain,
    commit: (intent: Intent, exact?: Version) =>
      binding.lease
        ? queue.commit(binding.lease, intent, exact)
        : Promise.resolve(null),
    commitExact: (
      action: PlannedAction,
      version: Version,
      mayDispatch: () => boolean,
    ) =>
      binding.lease
        ? queue.commitExact(binding.lease, action, version, mayDispatch)
        : Promise.resolve(null),
    history: (redo: boolean) =>
      binding.lease
        ? queue.history(binding.lease, redo)
        : Promise.resolve(null),
    inspect: (action: PlannedAction, exact?: Version) =>
      binding.lease
        ? queue.inspect(binding.lease, action, exact)
        : Promise.resolve(null),
    clearPreview: () => {
      if (binding.lease) queue.clearPreview(binding.lease);
    },
    document,
    reconcile: async () => {
      const lease = binding.lease;
      if (!lease) return;
      await queue.reconcile(lease);
      if (binding.lease === lease && queue.isReady(lease))
        renderReady((n) => n + 1);
    },
  };
}
