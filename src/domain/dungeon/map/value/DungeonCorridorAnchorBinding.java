package src.domain.dungeon.map.value;

public record DungeonCorridorAnchorBinding(
        long anchorId,
        long hostCorridorId,
        DungeonCell absoluteCell,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorAnchorBinding {
        anchorId = Math.max(0L, anchorId);
        hostCorridorId = Math.max(0L, hostCorridorId);
        absoluteCell = absoluteCell == null ? new DungeonCell(0, 0, 0) : absoluteCell;
        topologyRef = topologyRef == null || !topologyRef.present()
                ? new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR_ANCHOR, anchorId)
                : topologyRef;
    }

    public DungeonCorridorAnchorBinding withAbsoluteCell(DungeonCell nextCell) {
        return new DungeonCorridorAnchorBinding(anchorId, hostCorridorId, nextCell, topologyRef);
    }
}
