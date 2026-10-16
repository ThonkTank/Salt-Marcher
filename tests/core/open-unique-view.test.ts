import assert from "node:assert/strict";
import test from "node:test";
import { createUniqueCatalogOpener } from "../../src/features/catalog/creature-catalog-view-content";

interface UniqueViewLeaf {
  setViewState(state: { type: string; active: boolean }): Promise<void>;
  detach(): void;
}

interface UniqueViewWorkspace<Leaf extends UniqueViewLeaf> {
  getLeavesOfType(viewType: string): readonly Leaf[];
  getLeaf(kind: "tab"): Leaf;
  revealLeaf(leaf: Leaf): void;
}

class FakeLeaf implements UniqueViewLeaf {
  states: { type: string; active: boolean }[] = [];
  detached = false;
  constructor(private readonly pending: Promise<void>) {}
  async setViewState(state: { type: string; active: boolean }): Promise<void> {
    this.states.push(state);
    await this.pending;
  }
  detach(): void { this.detached = true; }
}

test("unique view opener serializes overlapping creation calls", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const created: FakeLeaf[] = [];
  const revealed: FakeLeaf[] = [];
  const workspace: UniqueViewWorkspace<FakeLeaf> = {
    getLeavesOfType: () => created,
    getLeaf: () => {
      const leaf = new FakeLeaf(pending);
      created.push(leaf);
      return leaf;
    },
    revealLeaf: (leaf) => { revealed.push(leaf); },
  };
  const opener = createUniqueCatalogOpener(workspace, "catalog");
  const first = opener();
  const second = opener();
  assert.equal(first, second);
  release();
  await first;
  await second;
  assert.equal(created.length, 1);
  assert.deepEqual(revealed, [created[0]]);
  assert.deepEqual(created[0]?.states, [{ type: "catalog", active: true }]);
});

test("unique view opener keeps the first existing leaf and detaches duplicates", async () => {
  const pending = Promise.resolve();
  const first = new FakeLeaf(pending);
  const duplicate = new FakeLeaf(pending);
  const third = new FakeLeaf(pending);
  const revealed: FakeLeaf[] = [];
  const workspace: UniqueViewWorkspace<FakeLeaf> = {
    getLeavesOfType: () => [first, duplicate, third],
    getLeaf: () => { throw new Error("must not create a new leaf"); },
    revealLeaf: (leaf) => { revealed.push(leaf); },
  };
  await createUniqueCatalogOpener(workspace, "catalog")();
  assert.equal(first.detached, false);
  assert.equal(duplicate.detached, true);
  assert.equal(third.detached, true);
  assert.deepEqual(revealed, [first]);
});
