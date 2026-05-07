package src.domain.dungeon.map.value;

import java.util.Objects;

/**
 * Persisted authored map metadata.
 */
public final class DungeonMapMetadata {
    private final DungeonMapIdentity mapId;
    private final String mapName;

    public DungeonMapMetadata(
            DungeonMapIdentity mapId,
            String mapName
    ) {
        this.mapId = mapId;
        this.mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName.trim();
    }

    public DungeonMapIdentity mapId() {
        return mapId;
    }

    public String mapName() {
        return mapName;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonMapMetadata that
                && Objects.equals(mapId, that.mapId)
                && Objects.equals(mapName, that.mapName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(mapId, mapName);
    }

    @Override
    public String toString() {
        return "DungeonMapMetadata[mapId=" + mapId + ", mapName=" + mapName + "]";
    }
}
