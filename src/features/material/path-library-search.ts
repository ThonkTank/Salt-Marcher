/** Visible input and applied filter differ after Dungeondraft's Clear Search action. */
export interface PathLibrarySearchState {
  readonly text: string;
  /** Null shows the complete library; matching rules belong to the library. */
  readonly appliedQuery: string | null;
}

export function newPathLibrarySearchState(): PathLibrarySearchState {
  return { text: "", appliedQuery: null };
}

export function setPathLibrarySearchText(
  state: PathLibrarySearchState,
  text: string,
): PathLibrarySearchState {
  return { ...state, text };
}

/** DD-021.27: the field X clears visible text; its effect on applied results is unmeasured. */
export function clearPathLibrarySearchText(
  state: PathLibrarySearchState,
): PathLibrarySearchState {
  return { ...state, text: "" };
}

/** The directly observed search was applied when Return was pressed. */
export function applyPathLibrarySearch(state: PathLibrarySearchState): PathLibrarySearchState {
  return { ...state, appliedQuery: state.text };
}

/** DD-021.24: restore all tiles without erasing the field's visible text. */
export function clearPathLibrarySearch(state: PathLibrarySearchState): PathLibrarySearchState {
  return { ...state, appliedQuery: null };
}
