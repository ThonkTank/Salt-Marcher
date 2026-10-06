const test = require("node:test");
const assert = require("node:assert/strict");
const { assess } = require("./gui-memory-guard.cjs");

const GIB = 1024 ** 3;
const memory = (available, swapFree) => ({
  total: 7.3 * GIB,
  available: available * GIB,
  swapTotal: 7.3 * GIB,
  swapFree: swapFree * GIB,
});

test("graphics launch waits for enough physical headroom", () => {
  assert.deepEqual(assess(memory(3.5, 5.9), "launch").reasons,
    ["MemAvailable"]);
  assert.equal(assess(memory(5, 5.9), "launch").allowed, true);
});

test("running graphics stop before the observed OOM reserve", () => {
  assert.deepEqual(assess(memory(1.4, 2.6), "runtime").reasons,
    ["MemAvailable", "SwapFree"]);
  assert.equal(assess(memory(2.5, 5), "runtime").allowed, true);
});

test("systems without swap use physical reserve alone", () => {
  assert.equal(assess({ total: 8 * GIB, available: 6 * GIB,
    swapTotal: 0, swapFree: 0 }, "launch").allowed, true);
});
