import type { Commands } from "../../src/atlas/client";
import type { AllCommands } from "../../src/atlas/generated/AllCommands";

// File paths belong to the isolated Playwright fixture, not browser callers.
export type BrowserCommands = Commands &
  Pick<AllCommands, "detail"> & {
    [K in "open" | "save"]: {
      args: Record<string, never>;
      result: AllCommands[K]["result"];
    };
  };
export type BrowserCommand = keyof BrowserCommands;
export type BrowserCall<K extends BrowserCommand = BrowserCommand> = {
  [C in K]: { cmd: C; args: BrowserCommands[C]["args"] };
}[K];
export type BrowserRequest = <K extends BrowserCommand>(
  cmd: K,
  args: BrowserCommands[K]["args"],
) => Promise<BrowserCommands[K]["result"]>;
