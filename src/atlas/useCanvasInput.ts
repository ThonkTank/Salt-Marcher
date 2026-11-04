import {
  useEffect,
  useRef,
  type CanvasHTMLAttributes,
  type RefObject,
} from "react";
import { workflowPointer } from "./editorWorkflow";
import type { EditorWorkflowController } from "./editorWorkflowController";
import {
  decideDoubleClick,
  decideKey,
  decidePointerDown,
  decideWheel,
  evaluatePointer,
  hoverAtPoint,
  type CanvasCommand,
  type CanvasInputSnapshot,
} from "./interaction";
import { screenToWorld, type ScreenPoint } from "./model";

type Options = {
  host: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
  controller: EditorWorkflowController;
  snapshot: () => CanvasInputSnapshot;
  dispatch: (command: CanvasCommand) => void;
  setSize: (size: { width: number; height: number }) => void;
  setHoverPoint?: (point: import("./model").WorldPoint | null) => void;
  setHover: (hover: { point: ScreenPoint; reason: string } | null) => void;
};
type Handlers = Required<
  Pick<
    CanvasHTMLAttributes<HTMLCanvasElement>,
    | "onPointerDown"
    | "onPointerMove"
    | "onPointerLeave"
    | "onPointerUp"
    | "onPointerCancel"
    | "onLostPointerCapture"
    | "onWheel"
    | "onDoubleClick"
  >
>;

export function useCanvasInput(options: Options): Handlers & {
  releaseCapture(pointer?: number): void;
  abortPointer(pointer?: number): void;
} {
  const current = useRef(options);
  current.current = options;
  const space = useRef(false),
    capturedPointer = useRef<number | null>(null);
  const snapshot = () => ({
    ...current.current.snapshot(),
    workflow: current.current.controller.getSnapshot(),
  });
  const releaseCapture = (pointer?: number) => {
    const id = capturedPointer.current;
    if (id === null || (pointer !== undefined && pointer !== id)) return;
    capturedPointer.current = null;
    const element = current.current.canvas.current;
    if (element?.hasPointerCapture(id)) element.releasePointerCapture(id);
  };
  const abortPointer = (pointer?: number) => {
    current.current.controller.abortPointer(pointer);
    releaseCapture(pointer);
  };
  const point = (
    event: { clientX: number; clientY: number },
    state: CanvasInputSnapshot,
  ) => {
    const rect = current.current.canvas.current!.getBoundingClientRect();
    return screenToWorld(
      [event.clientX - rect.left, event.clientY - rect.top],
      state.camera,
    );
  };
  const execute = (commands: CanvasCommand[]) =>
    commands.forEach(current.current.dispatch);
  useEffect(() => {
    const host = current.current.host.current;
    const observer = new ResizeObserver(([entry]) =>
      current.current.setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    if (host) observer.observe(host);
    const down = (event: KeyboardEvent) => {
      const decision = decideKey(snapshot(), {
        key: event.key,
        code: event.code,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
        formTarget:
          event.target instanceof HTMLElement &&
          !!event.target.closest("input,select,textarea"),
      });
      if (decision.preventDefault) event.preventDefault();
      if (decision.space !== null) space.current = decision.space;
      execute(decision.commands);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") space.current = false;
    };
    const blur = () => {
      space.current = false;
      abortPointer();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      releaseCapture();
    };
  }, []);
  return {
    releaseCapture,
    abortPointer,
    onPointerDown: (event) => {
      const state = snapshot();
      const decision = decidePointerDown(state, {
        pointer: event.pointerId,
        button: event.button,
        point: point(event, state),
        screen: [event.clientX, event.clientY],
        alt: event.altKey,
        space: space.current,
      });
      if (decision.focus) event.currentTarget.focus();
      if (decision.capture) {
        event.currentTarget.setPointerCapture(event.pointerId);
        capturedPointer.current = event.pointerId;
      }
      execute(decision.commands);
    },
    onPointerLeave: () => current.current.setHoverPoint?.(null),
    onPointerMove: (event) => {
      const state = snapshot(),
        p = point(event, state);
      current.current.setHoverPoint?.(p);
      if (!workflowPointer(state.workflow)) {
        current.current.setHover(hoverAtPoint(state, p));
        return;
      }
      const result = evaluatePointer(
        state,
        {
          pointer: event.pointerId,
          point: p,
          screen: [event.clientX, event.clientY],
          alt: event.altKey,
        },
        false,
      );
      if (!result) return;
      current.current.controller.evaluate(result, false);
      if (result.camera) execute([{ kind: "camera", camera: result.camera }]);
    },
    onPointerUp: (event) => {
      const state = snapshot();
      const result = evaluatePointer(
        state,
        {
          pointer: event.pointerId,
          point: point(event, state),
          screen: [event.clientX, event.clientY],
          alt: event.altKey,
        },
        true,
      );
      // Finish removes the active pointer before normal lostcapture is delivered.
      if (result) current.current.controller.evaluate(result, true);
      releaseCapture(event.pointerId);
      if (result?.camera) execute([{ kind: "camera", camera: result.camera }]);
    },
    onPointerCancel: (event) => abortPointer(event.pointerId),
    onLostPointerCapture: (event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId))
        abortPointer(event.pointerId);
    },
    onWheel: (event) => {
      const state = snapshot();
      execute(decideWheel(state, point(event, state), event.deltaY));
    },
    onDoubleClick: (event) => {
      const state = snapshot();
      execute(decideDoubleClick(state, point(event, state)));
    },
  };
}
