#!/usr/bin/env node
const fs = require("node:fs");

const GIB = 1024 ** 3;

function snapshot() {
  const fields = Object.fromEntries(fs.readFileSync("/proc/meminfo", "utf8")
    .split("\n")
    .map((line) => /^([^:]+):\s+(\d+)\s+kB$/.exec(line))
    .filter(Boolean)
    .map((match) => [match[1], Number(match[2]) * 1024]));
  for (const key of ["MemTotal", "MemAvailable", "SwapTotal", "SwapFree"])
    if (!Number.isFinite(fields[key])) throw new Error(`${key} fehlt in /proc/meminfo`);
  return {
    total: fields.MemTotal,
    available: fields.MemAvailable,
    swapTotal: fields.SwapTotal,
    swapFree: fields.SwapFree,
  };
}

function assess(memory, phase) {
  const launch = phase === "launch";
  if (!launch && phase !== "runtime") throw new Error(`Unbekannte Phase: ${phase}`);
  const minAvailable = launch
    ? Math.max(4 * GIB, Math.ceil(memory.total * 0.58))
    : Math.max(1.5 * GIB, Math.ceil(memory.total * 0.22));
  const minSwapFree = memory.swapTotal
    ? (launch
      ? Math.max(3 * GIB, Math.ceil(memory.swapTotal * 0.45))
      : Math.max(2 * GIB, Math.ceil(memory.swapTotal * 0.40)))
    : 0;
  const reasons = [];
  if (memory.available < minAvailable) reasons.push("MemAvailable");
  if (memory.swapTotal && memory.swapFree < minSwapFree) reasons.push("SwapFree");
  return { allowed: reasons.length === 0, phase, ...memory,
    minAvailable, minSwapFree, reasons };
}

function runCli(args) {
  const [mode, target] = args;
  if (mode === "check" && !target) {
    const result = assess(snapshot(), "launch");
    process.stdout.write(JSON.stringify(result) + "\n");
    if (!result.allowed) process.exitCode = 75;
    return;
  }
  if (mode === "watch" && /^\d+$/.test(target ?? "")) {
    const pid = Number(target);
    if (pid <= 1 || pid === process.pid) throw new Error("Ungültiger Zielprozess");
    const check = () => {
      if (!fs.existsSync(`/proc/${pid}`)) { clearInterval(timer); return; }
      const result = assess(snapshot(), "runtime");
      if (result.allowed) return;
      process.stdout.write(JSON.stringify(result) + "\n");
      try { process.kill(pid, "SIGTERM"); } catch {}
      clearInterval(timer);
      process.exitCode = 75;
    };
    const timer = setInterval(check, 250);
    check();
    return;
  }
  throw new Error("Usage: gui-memory-guard.cjs check | watch PID");
}

if (require.main === module) {
  try { runCli(process.argv.slice(2)); }
  catch (error) { console.error(error); process.exitCode = 1; }
}

module.exports = { snapshot, assess };
