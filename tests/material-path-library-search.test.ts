import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPathLibrarySearch,
  clearPathLibrarySearch,
  newPathLibrarySearchState,
  setPathLibrarySearchText,
} from "../src/features/material/path-library-search";

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
