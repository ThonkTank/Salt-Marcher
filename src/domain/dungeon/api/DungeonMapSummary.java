package src.domain.dungeon.api;

/**
 * Search/list metadata for authored dungeon maps.
 */
public record DungeonMapSummary(
        DungeonMapId mapId,
        String mapName,
        long revision
) {

    public DungeonMapSummary {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        revision = Math.max(0L, revision);
    }

    @Override
    public String toString() {
        return mapName + "  (rev " + revision + ")";
    }
}
