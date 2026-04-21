package src.data.dungeon.model;

public record DungeonRoomClusterVertexRecord(
        long clusterId,
        int levelZ,
        int vertexIndex,
        int relativeX,
        int relativeY
) {
}
