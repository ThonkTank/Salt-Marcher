import {
  applyPathLibrarySearch,
  clearPathLibrarySearch,
  clearPathLibrarySearchText,
  setPathLibrarySearchText,
  type PathLibrarySearchState,
} from "./path-library-search";

export interface PathLibraryTile {
  readonly id: string;
  readonly name: string;
  readonly previewUrl: string;
}

export interface PathLibraryViewOptions {
  readonly tiles: readonly PathLibraryTile[];
  readonly searchState: PathLibrarySearchState;
  readonly selectedId?: string;
  /** The native Fuzzy/Exact matching rules still need a separate comparison. */
  readonly matches: (tile: PathLibraryTile, query: string) => boolean;
  readonly onSearchStateChange: (state: PathLibrarySearchState) => void;
  readonly onSelect: (id: string) => void;
}

export function visiblePathLibraryTiles(
  tiles: readonly PathLibraryTile[],
  state: PathLibrarySearchState,
  matches: PathLibraryViewOptions["matches"],
): readonly PathLibraryTile[] {
  return state.appliedQuery === null
    ? tiles
    : tiles.filter((tile) => matches(tile, state.appliedQuery!));
}

/** Mounts only the Path Library controls; the caller owns assets and map edits. */
export function mountPathLibraryView(
  host: HTMLElement,
  options: PathLibraryViewOptions,
): void {
  const document = host.ownerDocument;
  let state = options.searchState;
  const section = document.createElement("section");
  section.className = "dn-path-library";
  section.setAttribute("aria-label", "Pfadbibliothek");

  const heading = document.createElement("h3");
  heading.textContent = "Pfadbibliothek";
  const controls = document.createElement("div");
  controls.className = "dn-path-library-controls";
  const label = document.createElement("label");
  label.textContent = "Suche";
  const searchField = document.createElement("span");
  searchField.style.display = "inline-flex";
  searchField.style.alignItems = "center";
  const input = document.createElement("input");
  input.type = "text";
  input.value = state.text;
  input.setAttribute("aria-label", "Pfadbibliothek durchsuchen");
  const fieldX = document.createElement("button");
  fieldX.type = "button";
  fieldX.textContent = "×";
  fieldX.title = "Suchfeld leeren";
  fieldX.setAttribute("aria-label", "Pfadbibliothek Suchfeld leeren");
  fieldX.hidden = !state.text;
  searchField.append(input, fieldX);
  label.append(searchField);
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Suche zurücksetzen";
  clear.title = "Clear Search";
  const list = document.createElement("ul");
  list.className = "dn-path-library-tiles";
  list.setAttribute("aria-label", "Pfadtexturen");

  const renderTiles = () => {
    list.replaceChildren();
    for (const tile of visiblePathLibraryTiles(options.tiles, state, options.matches)) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.title = tile.name;
      button.setAttribute("aria-label", tile.name);
      button.setAttribute("aria-pressed", String(tile.id === options.selectedId));
      const image = document.createElement("img");
      image.src = tile.previewUrl;
      image.alt = "";
      image.loading = "lazy";
      image.width = 140;
      image.height = 48;
      button.append(image);
      button.addEventListener("click", () => options.onSelect(tile.id));
      item.append(button);
      list.append(item);
    }
  };

  input.addEventListener("input", () => {
    state = setPathLibrarySearchText(state, input.value);
    fieldX.hidden = !state.text;
    options.onSearchStateChange(state);
  });
  fieldX.addEventListener("click", () => {
    state = clearPathLibrarySearchText(state);
    input.value = "";
    fieldX.hidden = true;
    options.onSearchStateChange(state);
    input.focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    state = applyPathLibrarySearch(state);
    options.onSearchStateChange(state);
    renderTiles();
  });
  clear.addEventListener("click", () => {
    state = clearPathLibrarySearch(state);
    options.onSearchStateChange(state);
    renderTiles();
  });
  controls.append(label, clear);
  section.append(heading, controls, list);
  host.append(section);
  renderTiles();
}
