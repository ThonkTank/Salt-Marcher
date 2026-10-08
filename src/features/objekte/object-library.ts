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

function words(asset: AssetDefinition, path: string | undefined): readonly string[] {
  const source = path?.split("textures/objects/").at(-1) ?? asset.name;
  return source.replace(/\.[^./\\]+$/, "")
    .split(/[_/\\ .]/).filter((word) => !!word && !/^[+-]?\d+$/.test(word))
    .map((word) => word.toLocaleLowerCase("en"));
}

export interface ObjectAssetEntry {
  readonly asset: AssetDefinition;
  readonly path: string | undefined;
  readonly words: readonly string[];
}

/** Read-only asset data reused across search, tags and the browser grid. */
export function indexObjectAssets(assets: readonly AssetDefinition[]): readonly ObjectAssetEntry[] {
  return assets.filter((asset) => asset.kind === "object").map((asset) => {
    const path = objectPath(asset);
    return { asset, path, words: words(asset, path) };
  });
}

export function sortedObjectAssetEntries(assets: readonly AssetDefinition[]): readonly ObjectAssetEntry[] {
  return [...indexObjectAssets(assets)].sort((a, b) => {
    const ap = a.path ?? "", bp = b.path ?? "";
    const an = ap.startsWith("res://textures/") ? 0 : 1;
    const bn = bp.startsWith("res://textures/") ? 0 : 1;
    return an - bn || ap.localeCompare(bp, "en");
  });
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

export function visibleObjectEntries(entries: readonly ObjectAssetEntry[],
  document: ObjectTagDocument, state: ObjectLibraryState): readonly ObjectAssetEntry[] {
  let visible = entries;
  if (state.tab === "used")
    visible = visible.filter((entry) => state.usedIds.has(entry.asset.id));
  else if (state.tab === "tags") {
    const paths = new Set([...state.tags].flatMap((tag) => document.tags[tag] ?? []));
    visible = visible.filter((entry) => !!entry.path && paths.has(entry.path));
  } else if (state.appliedQuery !== null && state.appliedQuery.trim()) {
    const terms = state.appliedQuery.trim().split(/\s+/);
    visible = visible.filter((entry) => {
      return terms.every((term) => entry.words.some((token) =>
        objectWordSimilarity(token, term) >= state.appliedStrictness));
    });
  }
  return visible;
}

export function visibleObjectAssets(assets: readonly AssetDefinition[],
  document: ObjectTagDocument, state: ObjectLibraryState): readonly AssetDefinition[] {
  return visibleObjectEntries(indexObjectAssets(assets), document, state)
    .map((entry) => entry.asset);
}
