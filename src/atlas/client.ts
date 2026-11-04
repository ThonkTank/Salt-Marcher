import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { normalizeWireError } from "../wireError";
import type {
  Commands as WireCommands,
  ReadCommands as WireReadCommands,
} from "./generated/Commands";
import type { SceneResponse } from "./generated/SceneResponse";
import type { ValidPreviewWire } from "./generated/ValidPreviewWire";
import type { InvalidPreviewWire } from "./generated/InvalidPreviewWire";
import type { Intent as WireIntent } from "./generated/Intent";
import type {
  Scene,
  Status,
  Version,
  Intent,
  Preview,
  ValidPreview,
} from "./model";

type UiArgs<T> = T extends { intent: WireIntent }
  ? Omit<T, "intent"> & { intent: Intent }
  : T;
type UiResult<T> = T extends SceneResponse
  ? Scene
  : T extends ValidPreviewWire
    ? ValidPreview
    : T extends InvalidPreviewWire
      ? Extract<Preview, { valid: false }>
      : T;
export type Commands = {
  [K in keyof WireCommands]: {
    args: UiArgs<WireCommands[K]["args"]>;
    result: UiResult<WireCommands[K]["result"]>;
  };
};
export type ReadCommands = Pick<Commands, keyof WireReadCommands>;
// The untyped transport is isolated here; callers cannot choose the result type.
export type Transport = (
  cmd: string,
  args: Record<string, unknown>,
) => Promise<unknown>;
export class AtlasClient {
  constructor(
    private readonly transport: Transport = (cmd, args) =>
      invoke("atlas_request", { cmd, args }),
  ) {}
  async request<K extends keyof Commands>(
    cmd: K,
    args: Commands[K]["args"],
  ): Promise<Commands[K]["result"]> {
    try {
      return (await this.transport(cmd, args)) as Commands[K]["result"];
    } catch (error) {
      throw normalizeWireError(error);
    }
  }
  read<K extends keyof ReadCommands>(
    cmd: K,
    args: ReadCommands[K]["args"],
  ): Promise<ReadCommands[K]["result"]> {
    return this.request(cmd, args);
  }
  async onCloseRequested(handler: () => void): Promise<() => void> {
    if (!isTauri()) return () => {};
    return getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      handler();
    });
  }
  async close(): Promise<void> {
    if (isTauri()) await getCurrentWindow().destroy();
  }
  open(version: Version): Promise<Status | null> {
    return invoke<Status | null>("atlas_open", { version }).catch(
      (e: unknown) => {
        throw normalizeWireError(e);
      },
    );
  }
  save(version: Version, saveAs = false): Promise<Status | null> {
    return invoke<Status | null>("atlas_save", { version, saveAs }).catch(
      (e: unknown) => {
        throw normalizeWireError(e);
      },
    );
  }
}
