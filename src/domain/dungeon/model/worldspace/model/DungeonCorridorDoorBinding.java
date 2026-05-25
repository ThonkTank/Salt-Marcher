package src.domain.dungeon.model.worldspace.model;

public record DungeonCorridorDoorBinding(
        long roomId,
        long clusterId,
        DungeonCell relativeCell,
        DungeonEdgeDirection direction,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorDoorBinding {
        relativeCell = relativeCell == null ? new DungeonCell(0, 0, 0) : relativeCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public boolean hasTopologyRef() {
        return topologyRef.present();
    }
}
