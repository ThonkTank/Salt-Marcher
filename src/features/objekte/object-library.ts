import type { AssetDefinition } from "../../assets";
import { objectPath, type ObjectTagDocument } from "./object-tags";

export type ObjectLibraryTab = "all" | "used" | "tags";

/** Godot 3 String.similarity, measured against Fuzzy/Exact object results. */
export function objectWordSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  let matches = 0;
  for (let index = 0; index < left.length - 1; index++)
    if (right.includes(left.slice(index, index + 2))) matches++;
  return Math.fround((2 * matches) / (left.length + right.length - 2));
}

function words(asset: AssetDefinition): readonly string[] {
  const source = objectPath(asset)?.split("textures/objects/").at(-1) ?? asset.name;
  return source.replace(/\.[^./\\]+$/, "")
    .split(/[_/\\ .]/).filter((word) => !!word && !/^[+-]?\d+$/.test(word))
    .map((word) => word.toLocaleLowerCase("en"));
}

export interface ObjectLibraryState {
  readonly tab: ObjectLibraryTab;
  readonly text: string;
  readonly appliedQuery: string | null;
  readonly strictness: number;
  readonly appliedStrictness: number;
  readonly selectedId: string;
  readonly set: string;
  readonly tags: ReadonlySet<string>;
  readonly usedIds: ReadonlySet<string>;
}

export function newObjectLibraryState(selectedId = ""): ObjectLibraryState {
  return { tab: "all", text: "", appliedQuery: null,
    strictness: 0.5, appliedStrictness: 0.5, selectedId,
    set: "---", tags: new Set(), usedIds: new Set() };
}

export function enterObjectLibraryTab(state: ObjectLibraryState,
  tab: ObjectLibraryTab, usedIds: readonly string[] = []): ObjectLibraryState {
  if (state.tab === tab) return state;
  return { ...state, tab,
    usedIds: tab === "used" ? new Set(usedIds) : state.usedIds };
}

/** A plain click replaces the tag choice; Ctrl-click toggles an additional tag. */
export function chooseObjectTag(state: ObjectLibraryState, name: string,
  additive: boolean): ObjectLibraryState {
  const tags = additive ? new Set(state.tags) : new Set<string>();
  if (additive && tags.has(name)) tags.delete(name);
  else tags.add(name);
  return { ...state, set: "", tags };
}

/** The native set chooser replaces all checked tags, including the empty `---` set. */
export function chooseObjectSet(state: ObjectLibraryState, name: string,
  document: ObjectTagDocument): ObjectLibraryState {
  return { ...state, set: name,
    tags: new Set(name === "---" ? [] : document.sets[name] ?? []) };
}

export function applyObjectSearch(state: ObjectLibraryState): ObjectLibraryState {
  return { ...state, appliedQuery: state.text.toLocaleLowerCase("en"),
    appliedStrictness: state.strictness, selectedId: "" };
}

export function clearObjectSearchText(state: ObjectLibraryState): ObjectLibraryState {
  return { ...state, text: "" };
}

export function resetObjectSearch(state: ObjectLibraryState): ObjectLibraryState {
  return { ...state, appliedQuery: null, selectedId: "" };
}

export function visibleObjectAssets(assets: readonly AssetDefinition[],
  document: ObjectTagDocument, state: ObjectLibraryState): readonly AssetDefinition[] {
  let visible = assets.filter((asset) => asset.kind === "object");
  if (state.tab === "used")
    visible = visible.filter((asset) => state.usedIds.has(asset.id));
  else if (state.tab === "tags") {
    const paths = new Set([...state.tags].flatMap((tag) => document.tags[tag] ?? []));
    visible = visible.filter((asset) => {
      const path = objectPath(asset);
      return !!path && paths.has(path);
    });
  } else if (state.appliedQuery !== null && state.appliedQuery.trim()) {
    const terms = state.appliedQuery.trim().split(/\s+/);
    visible = visible.filter((asset) => {
      const tokens = words(asset);
      return terms.every((term) => tokens.some((token) =>
        objectWordSimilarity(token, term) >= state.appliedStrictness));
    });
  }
  return visible;
}
