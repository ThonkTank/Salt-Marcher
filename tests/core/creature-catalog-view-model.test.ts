import assert from "node:assert/strict";
import test from "node:test";
import {
  CreatureCatalogDebouncer,
  type CatalogTimer,
} from "../../src/features/catalog/creature-catalog-view-model";

test("catalog debounce publishes only the latest 200-ms generation", () => {
  const pending = new Map<CatalogTimer, () => void>();
  let nextId = 0;
  const debouncer = new CreatureCatalogDebouncer(200, (callback, delay) => {
    assert.equal(delay, 200);
    const id = ++nextId as unknown as CatalogTimer;
    pending.set(id, callback);
    return id;
  }, (id) => { pending.delete(id); });
  const published: string[] = [];
  debouncer.schedule(() => published.push("old"));
  const old = 1 as unknown as CatalogTimer;
  debouncer.schedule(() => published.push("new"));
  assert.equal(pending.has(old), false);
  pending.values().next().value?.();
  assert.deepEqual(published, ["new"]);
});

test("catalog Enter flush and dispose cancel pending publication", () => {
  const pending = new Map<CatalogTimer, () => void>();
  let nextId = 0;
  const debouncer = new CreatureCatalogDebouncer(200, (callback) => {
    const id = ++nextId as unknown as CatalogTimer;
    pending.set(id, callback);
    return id;
  }, (id) => { pending.delete(id); });
  const published: string[] = [];
  debouncer.schedule(() => published.push("delayed"));
  debouncer.flush(() => published.push("enter"));
  assert.deepEqual(published, ["enter"]);
  assert.equal(pending.size, 0);
  debouncer.schedule(() => published.push("closed"));
  debouncer.dispose();
  assert.equal(pending.size, 0);
  assert.deepEqual(published, ["enter"]);
});

test("catalog timers are invoked without borrowing the debouncer receiver", () => {
  let timer = 0 as unknown as CatalogTimer;
  const debouncer = new CreatureCatalogDebouncer(200,
    function schedule(this: unknown, callback) {
      assert.equal(this, undefined);
      void callback;
      timer = 1 as unknown as CatalogTimer;
      return timer;
    },
    function cancel(this: unknown, current) {
      assert.equal(this, undefined);
      assert.equal(current, timer);
    });
  debouncer.schedule(() => undefined);
  debouncer.dispose();
});
