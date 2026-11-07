import type { BrowserRequest, BrowserCall } from "./browserContract";

// Compile-only checks; this function is never executed.
export function browserContractTypechecks(
  request: BrowserRequest,
  call: BrowserCall,
) {
  void request("history", {
    version: { sessionId: "test", revision: 0 },
    redo: false,
  });
  // @ts-expect-error Unknown commands cannot cross the typed test boundary.
  void request("missing", {});
  // @ts-expect-error History requires a document version and redo direction.
  void request("history", {});
  // @ts-expect-error The fixture owns the file path.
  void request("save", { path: "/arbitrary/file" });
  // @ts-expect-error Result types are determined by the command.
  const wrong: Promise<string> = request("status", {});
  void wrong;
  if (call.cmd === "history") {
    const redo: boolean | undefined = call.args.redo;
    void redo;
    // @ts-expect-error Narrowed history calls have no intent.
    void call.args.intent;
  }
}
