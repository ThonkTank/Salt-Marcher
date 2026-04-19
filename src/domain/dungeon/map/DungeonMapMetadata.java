package src.domain.dungeon.map;

import src.domain.dungeon.api.DungeonMapId;

/**
 * Persisted authored map metadata.
 */
public record DungeonMapMetadata(
        DungeonMapId mapId,
        String mapName
) {

    public DungeonMapMetadata {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName.trim();
    }
}
