package src.domain.dungeon.published;

/**
 * Authored dungeon map facts for an explicit map load.
 */
public record BaseMapSnapshot(
        DungeonMapId mapId,
        String mapName,
        long revision,
        int currentFloor,
        DungeonMapSnapshot map,
        boolean topologyEmpty
) {

    public BaseMapSnapshot {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        revision = Math.max(0L, revision);
        currentFloor = Math.max(0, currentFloor);
        map = map == null ? DungeonMapSnapshot.empty() : map;
    }
}
