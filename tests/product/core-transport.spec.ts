import { expect, test } from "@playwright/test";
import { startCoreTransport } from "../support/coreTransport";

const echo = `const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', line => process.stdout.write(line + '\\n'));`;

test("core transport correlates concurrent FIFO responses", async () => {
  const core = startCoreTransport({
    binary: process.execPath,
    args: ["-e", echo],
  });
  try {
    const first = core.request({ id: 1 }).then((line) => JSON.parse(line));
    const second = core.request({ id: 2 });
    expect(await first).toEqual({ id: 1 });
    expect(JSON.parse(await second)).toEqual({ id: 2 });
    expect(core.pendingCount).toBe(0);
  } finally {
    await core.close();
  }
});

test("core exit rejects all pending requests and subsequent requests", async () => {
  const core = startCoreTransport({
    binary: process.execPath,
    args: ["-e", "process.stdin.once('data', () => process.exit(7))"],
  });
  try {
    const results = await Promise.allSettled([
      core.request({ id: 1 }),
      core.request({ id: 2 }),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
    ]);
    await expect(core.request({ id: 3 })).rejects.toThrow("Core exited: 7");
    expect(core.pendingCount).toBe(0);
  } finally {
    await core.close();
  }
});

test("core spawn failure rejects requests and permits cleanup", async () => {
  const core = startCoreTransport({
    binary: "/nonexistent/saltmarcher-core-test",
  });
  try {
    await expect(core.request({})).rejects.toThrow();
  } finally {
    await core.close();
  }
});

test("core close rejects pending work, retains stderr tail and is idempotent", async () => {
  const tail: string[] = [];
  const core = startCoreTransport({
    binary: process.execPath,
    args: [
      "-e",
      "process.stdin.resume(); process.stdin.on('end', () => process.stderr.write('final event\\n'));",
    ],
    stderr: (line) => tail.push(line),
  });
  const pending = expect(core.request({})).rejects.toThrow(
    "Core transport closed",
  );
  const close = core.close();
  expect(core.close()).toBe(close);
  await close;
  await pending;
  expect(tail).toEqual(["final event"]);
  expect(core.pendingCount).toBe(0);
  await expect(core.request({})).rejects.toThrow("Core transport closed");
});

test("malformed wire JSON can be rejected without losing FIFO alignment", async () => {
  const core = startCoreTransport({
    binary: process.execPath,
    args: [
      "-e",
      `let count = 0; const rl = require('node:readline').createInterface({ input: process.stdin }); rl.on('line', () => process.stdout.write((count++ === 0 ? 'malformed' : '{"value":2}') + '\\n'));`,
    ],
  });
  try {
    const first = expect(
      core.request({}).then((line) => JSON.parse(line)),
    ).rejects.toThrow();
    const second = core.request({}).then((line) => JSON.parse(line));
    await first;
    expect(await second).toEqual({ value: 2 });
  } finally {
    await core.close();
  }
});

test("unsolicited response fails the transport and future requests", async () => {
  const core = startCoreTransport({
    binary: process.execPath,
    args: ["-e", "process.stdout.write('{}\\n'); process.stdin.resume();"],
  });
  try {
    await expect
      .poll(() => core.failure?.message)
      .toBe("Unmatched core response");
    await expect(core.request({})).rejects.toThrow("Unmatched core response");
  } finally {
    await core.close();
  }
});
