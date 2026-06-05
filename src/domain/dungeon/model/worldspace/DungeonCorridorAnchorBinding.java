package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record DungeonCorridorAnchorBinding(
        long anchorId,
        long hostCorridorId,
        Cell absoluteCell,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorAnchorBinding {
        CorridorAnchor anchor = new CorridorAnchor(
                anchorId,
                hostCorridorId,
                absoluteCell == null ? new Cell(0, 0, 0) : absoluteCell);
        anchorId = anchor.anchorId();
        hostCorridorId = anchor.hostCorridorId();
        absoluteCell = anchor.position();
        topologyRef = topologyRef == null || !topologyRef.present() ? DungeonTopologyRef.corridorAnchor(anchorId) : topologyRef;
    }

    public DungeonCorridorAnchorBinding withAbsoluteCell(Cell nextCell) {
        CorridorAnchor moved = new CorridorAnchor(anchorId, hostCorridorId, absoluteCell)
                .withPosition(nextCell == null ? new Cell(0, 0, 0) : nextCell);
        return new DungeonCorridorAnchorBinding(
                moved.anchorId(),
                moved.hostCorridorId(),
                moved.position(),
                topologyRef);
    }

    public boolean matchesTopologyRef(DungeonTopologyRef ref) {
        return ref != null && ref.present() && topologyRef.equals(ref);
    }

    public CorridorAnchor toCore() {
        return new CorridorAnchor(anchorId, hostCorridorId, absoluteCell);
    }
}
