import React from "react";
import "../../src/base.css";
import { createRoot } from "react-dom/client";
import AtlasApp from "../../src/atlas/AtlasApp";
import { AtlasClient } from "../../src/atlas/client";
import type { Scene, Status, Version } from "../../src/atlas/model";
import { useDocumentSession } from "../../src/atlas/useDocumentSession";
import { usePresentation } from "../../src/atlas/usePresentation";
import type { EditorContext, Bounds } from "../../src/atlas/model";
declare global {
  interface Window {
    atlasCore: <T>(cmd: string, args: Record<string, unknown>) => Promise<T>;
    atlasFailStatus?: boolean;
    atlasFailRead?: "mapTiles" | "scene" | "interiorMetadata" | "interiorTile";
    atlasClose?: () => void;
    atlasClosed?: boolean;
    atlasCancelSave?: boolean;
    atlasCancelOpen?: boolean;
    atlasHoldPicker?: "save" | "open";
    atlasPickerHeld?: boolean;
    atlasReleasePicker?: () => void;
    atlasHold?: { cmd: string; floor?: number };
    atlasHeld?: boolean;
    atlasRelease?: () => void;
    atlasFailCommit?: boolean;
    atlasFailFile?: "open" | "save";
    atlasUnmount?: () => void;
    atlasRemount?: () => void;
    atlasUnmounts?: number;
    atlasCalls: { cmd: string; args: Record<string, unknown> }[];
    atlasHook: ReturnType<typeof useDocumentSession>;
    atlasPresentationSet: (value: Partial<PresentationInput>) => void;
    atlasPresentation: ReturnType<typeof usePresentation>;
    atlasPresentationTrace: Array<{ enabled: boolean; fresh: boolean }>;
    atlasReadActive: number;
    atlasReadMax: number;
    atlasTileBarrier?: boolean;
    atlasTileReleases: Array<() => void>;
    atlasSceneBarrier?: boolean;
    atlasSceneHeld: Array<{
      args: Record<string, unknown>;
      scene: Scene;
      release: () => void;
      fail: boolean;
    }>;
  }
}
window.atlasCalls = [];
window.atlasTileReleases = [];
window.atlasSceneHeld = [];
window.atlasPresentationTrace = [];
async function browserTransportInner<T>(
  cmd: string,
  args: Record<string, unknown>,
): Promise<T> {
  window.atlasCalls.push({ cmd, args });
  if (cmd === "status" && window.atlasFailStatus)
    throw Error("Core unavailable");
  const result = await window.atlasCore<T>(cmd, args);
  if (cmd === "scene" && window.atlasSceneBarrier) {
    const held = {
      args: structuredClone(args),
      scene: result as Scene,
      release: () => {},
      fail: false,
    };
    await new Promise<void>((release) => {
      held.release = release;
      window.atlasSceneHeld.push(held);
    });
    if (held.fail) throw Error("Scene failed");
  }
  if (cmd === "interiorTile" && window.atlasTileBarrier)
    await new Promise<void>((resolve) =>
      window.atlasTileReleases.push(resolve),
    );
  const hold = window.atlasHold;
  if (
    hold?.cmd === cmd &&
    (hold.floor === undefined || hold.floor === args.floor)
  ) {
    window.atlasHold = undefined;
    window.atlasHeld = true;
    await new Promise<void>((resolve) => {
      window.atlasRelease = () => {
        window.atlasHeld = false;
        resolve();
      };
    });
  }
  if ((cmd === "open" || cmd === "save") && window.atlasFailFile === cmd) {
    window.atlasFailFile = undefined;
    throw Error("File response lost");
  }
  if (cmd === window.atlasFailRead) {
    window.atlasFailRead = undefined;
    throw Error(`${cmd} failed`);
  }
  if (cmd === "commit" && window.atlasFailCommit) {
    window.atlasFailCommit = false;
    throw Error("Commit response lost");
  }
  return result;
}
window.atlasReadActive = 0;
window.atlasReadMax = 0;
async function browserTransport<T>(
  cmd: string,
  args: Record<string, unknown>,
): Promise<T> {
  const read =
    cmd === "mapTiles" ||
    cmd === "scene" ||
    cmd === "interiorMetadata" ||
    cmd === "interiorTile";
  if (read) {
    window.atlasReadActive++;
    window.atlasReadMax = Math.max(window.atlasReadMax, window.atlasReadActive);
  }
  try {
    return await browserTransportInner<T>(cmd, args);
  } finally {
    if (read) window.atlasReadActive--;
  }
}
class BrowserClient extends AtlasClient {
  constructor() {
    super(browserTransport);
  }
  override async onCloseRequested(handler: () => void) {
    window.atlasClose = handler;
    return () => {
      if (window.atlasClose === handler) window.atlasClose = undefined;
    };
  }
  override async close() {
    window.atlasClosed = true;
  }
  private async picker(kind: "save" | "open") {
    if (window.atlasHoldPicker !== kind) return;
    window.atlasHoldPicker = undefined;
    window.atlasPickerHeld = true;
    await new Promise<void>((resolve) => {
      window.atlasReleasePicker = () => {
        window.atlasPickerHeld = false;
        resolve();
      };
    });
  }
  override async open(_version: Version) {
    await this.picker("open");
    if (window.atlasCancelOpen) return null;
    return browserTransport<Status>("open", {});
  }
  override async save(_version: Version, _saveAs = false) {
    await this.picker("save");
    return window.atlasCancelSave
      ? Promise.resolve(null)
      : browserTransport<Status>("save", {});
  }
}
const client = new BrowserClient();
const otherClient = new BrowserClient();
function HookHarness() {
  React.useEffect(
    () => () => {
      window.atlasUnmounts = (window.atlasUnmounts ?? 0) + 1;
    },
    [],
  );
  window.atlasHook = useDocumentSession(client);
  return null;
}
type PresentationInput = {
  status: Status | null;
  bounds: Bounds;
  active: string;
  context?: EditorContext;
  selectedId: string;
  floor: number;
  lower: boolean;
  client: "first" | "second";
  enabled: boolean;
};
function PresentationHarness() {
  const [input, setInput] = React.useState<PresentationInput>({
    status: null,
    bounds: [0, 0, 50, 50],
    active: "",
    selectedId: "",
    floor: 0,
    lower: true,
    client: "first",
    enabled: true,
  });
  window.atlasPresentationSet = (value) =>
    setInput((old) => ({ ...old, ...value }));
  window.atlasPresentation = usePresentation({
    client: input.client === "first" ? client : otherClient,
    status: input.status,
    bounds: input.bounds,
    editorContext:
      input.context ??
      (input.active
        ? { kind: "house", houseId: input.active }
        : { kind: "exterior" }),
    selectedId: input.selectedId,
    floor: input.floor,
    detailEnabled: input.enabled,
    includeLower: input.lower,
  });
  window.atlasPresentationTrace.push({
    enabled: input.enabled,
    fresh: window.atlasPresentation.fresh,
  });
  return (
    <output>
      {window.atlasPresentation.error ||
        (window.atlasPresentation.fresh ? "fresh" : "loading")}
    </output>
  );
}
const root = createRoot(document.getElementById("root")!);
window.atlasUnmount = () => root.render(null);
const render = () =>
  root.render(
    <React.StrictMode>
      {location.search === "?presentation" ? (
        <PresentationHarness />
      ) : location.search === "?hook" ? (
        <HookHarness />
      ) : (
        <AtlasApp client={client} />
      )}
    </React.StrictMode>,
  );
window.atlasRemount = render;
render();
