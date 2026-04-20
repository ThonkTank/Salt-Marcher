package src.domain.dungeon.map.value;

/**
 * Persisted authored map metadata.
 */
public record DungeonMapMetadata(
        DungeonMapIdentity mapId,
        String mapName
) {

    public DungeonMapMetadata {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName.trim();
    }
}
