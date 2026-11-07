import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  EditorWorkflowController,
  type WorkflowPorts,
} from "./editorWorkflowController";
export function useEditorWorkflow(ports: WorkflowPorts) {
  const [controller] = useState(() => new EditorWorkflowController(ports));
  controller.setPorts(ports);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useLayoutEffect(() => controller.sync());
  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);
  return { state, controller };
}
