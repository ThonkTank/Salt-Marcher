package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.Objects;

/** Metadata-only authored map identity returned by the catalog store. */
public record DungeonMapHeader(
        DungeonMapIdentity mapId,
        String mapName,
        long revision
) {
    public DungeonMapHeader {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (mapName == null || mapName.isBlank()) {
            throw new IllegalArgumentException("mapName must not be blank");
        }
        mapName = mapName.trim();
        if (revision < 1L) {
            throw new IllegalArgumentException("revision must be positive");
        }
    }
}
