/**
 * Forget removes a saved definition from the library. Existing map entities
 * keep their own geometry and prefabId and are deliberately outside this API.
 */
export function withoutPrefabDefinition<T extends { readonly id: string }>(
  prefabs: readonly T[],
  prefabId: string,
): readonly T[] {
  return prefabs.filter((prefab) => prefab.id !== prefabId);
}
