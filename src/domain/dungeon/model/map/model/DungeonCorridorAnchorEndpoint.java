package src.domain.dungeon.model.map.model;

public record DungeonCorridorAnchorEndpoint(
        long hostCorridorId,
        DungeonCell anchorCell,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorAnchorEndpoint {
        hostCorridorId = Math.max(0L, hostCorridorId);
        anchorCell = anchorCell == null ? new DungeonCell(0, 0, 0) : anchorCell;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public boolean present() {
        return hostCorridorId > 0L;
    }

    public DungeonCell corridorCell() {
        return anchorCell;
    }

    public int level() {
        return anchorCell.level();
    }
}
