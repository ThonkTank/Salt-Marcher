import { useCallback, useEffect, useReducer, useRef } from "react";
import type { MapObject } from "./model";
import {
  initialSelection,
  selectionReducer,
  selectionTransition,
  type SelectionEvent,
} from "./editorSelection";

type Options = {
  sessionId: string | undefined;
  recoveryEpoch: number;
  // Late-bound because canvas and workflow consume the selection state themselves.
  cleanup: () => void;
};

/** UI selection only. Workflow lifetimes and accepted writes keep their own owners. */
export function useEditorSelection(options: Options) {
  const [state, dispatch] = useReducer(selectionReducer, initialSelection);
  const current = useRef({ state, options });
  current.current = { state, options };
  const send = useCallback((event: SelectionEvent) => {
    if (selectionTransition(current.current.state, event).cancelInteraction)
      current.current.options.cleanup();
    dispatch(event);
  }, []);
  const cancelInteraction = useCallback(
    () => send({ type: "cancelInteraction" }),
    [send],
  );
  const selectObject = useCallback(
    (object: MapObject | undefined) =>
      send({ type: "selectObject", id: object?.id ?? "" }),
    [send],
  );
  useEffect(() => {
    send({ type: "sessionReplaced" });
  }, [options.sessionId, send]);
  useEffect(() => {
    if (options.recoveryEpoch) send({ type: "recoveryCompleted" });
  }, [options.recoveryEpoch, send]);
  return { state, send, cancelInteraction, selectObject };
}
