import { spawn, type SpawnOptions } from "node:child_process";
import { createInterface } from "node:readline";

type Pending = {
  resolve: (line: string) => void;
  reject: (error: Error) => void;
};

/** One JSONL FIFO and process lifetime; wire decoding belongs to the caller. */
export function startCoreTransport(options: {
  binary: string;
  args?: string[];
  env?: SpawnOptions["env"];
  stderr?: (line: string) => void;
}) {
  const child = spawn(options.binary, options.args ?? [], {
    stdio: ["pipe", "pipe", options.stderr ? "pipe" : "inherit"],
    env: options.env,
  });
  const stdin = child.stdin!;
  const lines = createInterface({ input: child.stdout! });
  const stderr = child.stderr
    ? createInterface({ input: child.stderr })
    : undefined;
  stderr?.on("line", options.stderr!);
  const pending: Pending[] = [];
  let failure: Error | undefined;
  let closing: Promise<void> | undefined;
  const fail = (error: Error) => {
    failure ??= error;
    for (const request of pending.splice(0)) request.reject(failure);
  };
  const exited = new Promise<void>((resolve) => {
    child.once("close", (code, signal) => {
      fail(Error(`Core exited: ${signal ?? code}`));
      resolve();
    });
  });
  child.on("error", fail);
  stdin.on("error", fail);
  lines.on("line", (line) => {
    const request = pending.shift();
    if (!request) return fail(Error("Unmatched core response"));
    request.resolve(line);
  });
  return {
    get pendingCount() {
      return pending.length;
    },
    get failure() {
      return failure;
    },
    request(envelope: unknown) {
      return new Promise<string>((resolve, reject) => {
        if (failure) return reject(failure);
        let wire: string;
        try {
          wire = JSON.stringify(envelope) + "\n";
        } catch (error) {
          reject(error instanceof Error ? error : Error(String(error)));
          return;
        }
        pending.push({ resolve, reject });
        stdin.write(wire);
      });
    },
    close() {
      return (closing ??= (async () => {
        fail(Error("Core transport closed"));
        stdin.end();
        const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
        try {
          await exited;
        } finally {
          clearTimeout(timer);
          lines.close();
          stderr?.close();
        }
      })());
    },
  };
}
export type CoreTransport = ReturnType<typeof startCoreTransport>;
