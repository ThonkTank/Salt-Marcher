package src.data.dungeon.model;

// LEGACY_REMOVE_ON_TOUCH: Vertex source record; entfernen, sobald dieser Bereich bearbeitet wird.
public record DungeonRoomClusterVertexRecord(
        long clusterId,
        int levelZ,
        int vertexIndex,
        int relativeX,
        int relativeY
) {
}
