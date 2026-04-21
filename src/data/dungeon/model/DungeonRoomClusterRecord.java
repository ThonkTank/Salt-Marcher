package src.data.dungeon.model;

import java.util.List;

public record DungeonRoomClusterRecord(
        long clusterId,
        long mapId,
        int centerX,
        int centerY,
        int levelZ,
        List<DungeonRoomClusterVertexRecord> vertices,
        List<DungeonClusterBoundaryRecord> boundaries
) {

    public DungeonRoomClusterRecord {
        vertices = vertices == null ? List.of() : List.copyOf(vertices);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
    }
}
