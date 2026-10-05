import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPathLibrarySearch,
  clearPathLibrarySearch,
  newPathLibrarySearchState,
  setPathLibrarySearchText,
} from "../src/features/material/path-library-search";
import {
  visiblePathLibraryTiles,
  type PathLibraryTile,
} from "../src/features/material/path-library-view";

test("DD-021.24 Clear Search restores the library while preserving visible input", () => {
  const initial = newPathLibrarySearchState();
  const typed = setPathLibrarySearchText(initial, "Battlements");
  const filtered = applyPathLibrarySearch(typed);
  assert.deepEqual(filtered, { text: "Battlements", appliedQuery: "Battlements" });

  const cleared = clearPathLibrarySearch(filtered);
  assert.deepEqual(cleared, { text: "Battlements", appliedQuery: null });
  assert.deepEqual(filtered, { text: "Battlements", appliedQuery: "Battlements" });
  assert.deepEqual(initial, { text: "", appliedQuery: null });
});

test("DD-021.24 tile view restores all entries without changing search text", () => {
  const tiles: PathLibraryTile[] = [
    { id: "b", name: "Battlements", previewUrl: "b.png" },
    { id: "c", name: "Chains", previewUrl: "c.png" },
  ];
  const matches = (tile: PathLibraryTile, query: string) =>
    tile.name.includes(query);
  const searched = applyPathLibrarySearch(
    setPathLibrarySearchText(newPathLibrarySearchState(), "Battlement"),
  );
  assert.deepEqual(
    visiblePathLibraryTiles(tiles, searched, matches).map((tile) => tile.id),
    ["b"],
  );
  const cleared = clearPathLibrarySearch(searched);
  assert.deepEqual(
    visiblePathLibraryTiles(tiles, cleared, matches).map((tile) => tile.id),
    ["b", "c"],
  );
  assert.equal(cleared.text, "Battlement");
});
