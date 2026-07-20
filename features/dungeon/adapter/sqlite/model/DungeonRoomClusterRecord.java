package features.dungeon.adapter.sqlite.model;

import java.util.List;

public record DungeonRoomClusterRecord(
        long clusterId,
        long mapId,
        String name,
        int centerX,
        int centerY,
        int levelZ,
        List<DungeonClusterBoundaryRecord> boundaries
) {

    public DungeonRoomClusterRecord {
        name = name == null || name.isBlank() ? "Cluster " + clusterId : name.trim();
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
    }
}
