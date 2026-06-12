package src.data.dungeon.model;

import java.util.List;

public record DungeonRoomClusterRecord(
        long clusterId,
        long mapId,
        String name,
        int centerX,
        int centerY,
        int levelZ,
        List<DungeonRoomClusterVertexRecord> vertices,
        List<DungeonRoomClusterFloorCellRecord> floorCells,
        List<DungeonClusterBoundaryRecord> boundaries
) {

    public DungeonRoomClusterRecord {
        name = name == null || name.isBlank() ? "Cluster " + clusterId : name.trim();
        vertices = vertices == null ? List.of() : List.copyOf(vertices);
        floorCells = floorCells == null ? List.of() : List.copyOf(floorCells);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
    }
}
