import { expect, it } from "vitest";
import { BudgetCache } from "./budgetCache";

it("counts replacement once and evicts least recently read entries", () => {
  const cache = new BudgetCache<string, string>(10);
  cache.set("a", "old", 5);
  cache.set("a", "new", 5);
  cache.set("b", "second", 5);
  cache.trim();
  expect(cache.get("a")).toBe("new");
  cache.set("c", "third", 5);
  cache.trim();
  expect(cache.has("b")).toBe(false);
  expect([...cache]).toEqual([
    ["a", "new"],
    ["c", "third"],
  ]);
});
it("bounds empty entries too and releases accounting after deletion and clear", () => {
  const cache = new BudgetCache<number, number>(4, 2);
  for (let i = 0; i < 3; i++) cache.set(i, i, 0);
  cache.trim();
  expect([...cache].map(([k]) => k)).toEqual([1, 2]);
  cache.set(3, 3, 4);
  cache.delete(3);
  cache.set(4, 4, 4);
  cache.trim();
  expect(cache.get(4)).toBe(4);
  cache.clear();
  cache.set(5, 5, 4);
  cache.trim();
  expect([...cache]).toEqual([[5, 5]]);
});

it("admits without evicting useful entries and accounts for replacements", () => {
  const cache = new BudgetCache<string, string>(10, 2);
  expect(cache.setIfFits("a", "first", 6)).toBe(true);
  expect(cache.setIfFits("b", "second", 4)).toBe(true);
  expect(cache.setIfFits("c", "overflow", 0)).toBe(false);
  expect(cache.setIfFits("a", "oversized replacement", 7)).toBe(false);
  expect(cache.get("a")).toBe("first");
  expect(cache.setIfFits("a", "smaller", 5)).toBe(true);
  expect(cache.setIfFits("b", "larger", 5)).toBe(true);
  cache.retain(["b", "c"]);
  expect(cache.setIfFits("c", "new", 5)).toBe(true);
  expect([...cache]).toEqual([
    ["b", "larger"],
    ["c", "new"],
  ]);
  cache.retain([]);
  expect(cache.setIfFits("d", "full", 10)).toBe(true);
});
it("stops working-set traversal after finding every retained key", () => {
  const cache = new BudgetCache<number, number>(1, 1);
  cache.setIfFits(1, 1);
  let visits = 0;
  cache.retain(
    (function* () {
      visits++;
      yield 1;
      visits++;
      yield 2;
    })(),
  );
  expect(visits).toBe(1);
  expect(cache.get(1)).toBe(1);
});
