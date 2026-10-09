import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { FileStore } from "../../../src/persistence";

function hex(value: string): string {
  return Buffer.from(value, "utf8").toString("hex");
}

function decode(value: string): string | null {
  return value === "-" ? null : Buffer.from(value, "hex").toString("utf8");
}

export class NativeFileStore implements FileStore {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: string[] = [];
  private readonly waiters: ((line: string) => void)[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  readonly ready: Promise<void>;
  readonly pid: number;
  readonly startedAt: string;

  constructor(helper: string, root: string, readonly processToken: string) {
    this.child = spawn(helper, [root, processToken], { stdio: ["pipe", "pipe", "pipe"] });
    if (!this.child.pid) throw new Error("native helper did not start");
    this.pid = this.child.pid;
    this.startedAt = new Date().toISOString();
    const reader = createInterface({ input: this.child.stdout });
    reader.on("line", (line) => {
      const waiter = this.waiters.shift();
      if (waiter) waiter(line); else this.lines.push(line);
    });
    this.ready = this.nextLine().then((line) => {
      if (line !== `READY ${this.pid} ${processToken}`)
        throw new Error(`unexpected native helper greeting: ${line}`);
    });
  }

  private nextLine(): Promise<string> {
    const line = this.lines.shift();
    if (line !== undefined) return Promise.resolve(line);
    return new Promise((resolve, reject) => {
      const onExit = () => reject(new Error("native helper exited before responding"));
      this.child.once("exit", onExit);
      this.waiters.push((value) => {
        this.child.off("exit", onExit);
        resolve(value);
      });
    });
  }

  private command(line: string): Promise<string> {
    const operation = this.chain.then(async () => {
      await this.ready;
      if (!this.child.stdin.write(line + "\n"))
        await new Promise<void>((resolve) => this.child.stdin.once("drain", resolve));
      const response = await this.nextLine();
      if (response.startsWith("ERR ")) throw new Error(`native helper: ${response}`);
      return response;
    });
    this.chain = operation.catch(() => {});
    return operation;
  }

  async read(path: string): Promise<string | null> {
    const response = await this.command(`READ ${hex(path)}`);
    if (!response.startsWith("OK READ ")) throw new Error(`unexpected native read: ${response}`);
    return decode(response.slice(8));
  }

  async compareAndWrite(path: string, before: string | null, after: string | null): Promise<void> {
    const response = await this.command(`CAS ${hex(path)} ${before === null ? "-" : hex(before)} ${after === null ? "-" : hex(after)}`);
    if (response !== "OK CAS") throw new Error(`unexpected native write: ${response}`);
  }

  async close(): Promise<number | null> {
    await this.chain.catch(() => {});
    this.child.stdin.end("QUIT\n");
    return new Promise((resolve) => this.child.once("exit", (code) => resolve(code)));
  }
}
