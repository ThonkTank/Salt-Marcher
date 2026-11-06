import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AtlasClient } from "../../src/atlas/client";
import { AtlasCanvas } from "../../src/atlas/AtlasCanvas";
import { useAtlasEditor } from "../../src/atlas/useAtlasEditor";
import type { Intent } from "../../src/atlas/model";

/** Test-only observation of the real editor and its two real canvases. */
export function canvasProbe() {
  const element = document.createElement("div");
  element.style.cssText =
    "position:fixed;left:0;top:0;width:800px;height:600px;z-index:10000";
  document.body.append(element);
  let pending = 0;
  const client = new AtlasClient(async (cmd, args) => {
    pending++;
    try {
      return await window.atlasCore(cmd as never, args as never);
    } finally {
      pending--;
    }
  });
  const root = createRoot(element);
  let editor: ReturnType<typeof useAtlasEditor>;
  let renders = 0,
    base = 0,
    overlay = 0,
    measures = 0;
  const overlayText: string[] = [];
  const baseText: string[] = [];
  let baseline:
    ReturnType<typeof useAtlasEditor>["canvasProps"]["scene"] | undefined;
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  const measure = CanvasRenderingContext2D.prototype.measureText;
  const fillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (element.contains(this.canvas)) {
      if (this.canvas.dataset.testid === "atlas-canvas") {
        base++;
        // AtlasCanvas clears the entire basis before each synchronous paint.
        // Observe that frame, not text from earlier intermediate frames.
        baseText.length = 0;
      }
      if (this.canvas.dataset.testid === "atlas-overlay") overlay++;
    }
    return clear.apply(this, args);
  };
  CanvasRenderingContext2D.prototype.measureText = function (...args) {
    if (
      element.contains(this.canvas) &&
      this.canvas.dataset.testid === "atlas-canvas"
    )
      measures++;
    return measure.apply(this, args);
  };
  CanvasRenderingContext2D.prototype.fillText = function (...args) {
    if (
      element.contains(this.canvas) &&
      this.canvas.dataset.testid === "atlas-overlay"
    )
      overlayText.push(args[0]);
    if (
      element.contains(this.canvas) &&
      this.canvas.dataset.testid === "atlas-canvas"
    )
      baseText.push(args[0]);
    return fillText.apply(this, args);
  };
  function Probe() {
    editor = useAtlasEditor(client);
    renders++;
    return (
      <div
        ref={editor.host}
        style={{ width: "800px", height: "600px", position: "relative" }}
      >
        <AtlasCanvas {...editor.canvasProps} />
      </div>
    );
  }
  root.render(
    <StrictMode>
      <Probe />
    </StrictMode>,
  );
  return {
    ready: () =>
      !!editor &&
      editor.reads.fresh &&
      !editor.reads.loading &&
      pending === 0 &&
      (editor.interior || (editor.regions.fresh && editor.rivers.fresh)),
    chooseTerrain: () => editor.chooseTool("terrain"),
    chooseRoad: () => editor.chooseTool("road"),
    chooseRegions: () => editor.chooseTool("regions"),
    chooseRank: (id: string) => editor.regions.chooseRank(id),
    catalog: () => editor.regions.catalog,
    clearText: () => {
      baseText.length = 0;
      overlayText.length = 0;
    },
    commit: (intent: Intent) => editor.session.commit(intent),
    zoom: (level: number) => editor.zoomToLevel(level),
    resize: (width: number, height: number) => {
      const host = editor.host.current!;
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
    },
    openHouse: (id: string) => editor.selectEvent({ type: "openHouse", id }),
    baseline: () => {
      baseline = editor.canvasProps.scene;
      return { renders, base, overlay, measures };
    },
    snapshot: () => ({
      sameScene: baseline === editor.canvasProps.scene,
      renders,
      base,
      overlay,
      measures,
      interior: editor.interior,
      cursor: editor.canvasProps.brushCursor,
      pending,
      overlayText: [...overlayText],
      baseText: [...baseText],
      preview: editor.canvasProps.preview,
      draft: editor.canvasProps.draft,
      baseImage: (
        element.querySelector(
          '[data-testid="atlas-canvas"]',
        ) as HTMLCanvasElement
      ).toDataURL(),
      canvasWidth: (
        element.querySelector(
          '[data-testid="atlas-canvas"]',
        ) as HTMLCanvasElement
      ).width,
      overlayImage: (
        element.querySelector(
          '[data-testid="atlas-overlay"]',
        ) as HTMLCanvasElement
      ).toDataURL(),
    }),
    pixel: (x: number, y: number) =>
      Array.from(
        (
          element.querySelector(
            '[data-testid="atlas-overlay"]',
          ) as HTMLCanvasElement
        )
          .getContext("2d")!
          .getImageData(x, y, 1, 1).data,
      ),
    close: () => {
      root.unmount();
      CanvasRenderingContext2D.prototype.clearRect = clear;
      CanvasRenderingContext2D.prototype.measureText = measure;
      CanvasRenderingContext2D.prototype.fillText = fillText;
      element.remove();
    },
  };
}
