package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.geometry.Cell;

public record DungeonCorridorAnchorBinding(
        long anchorId,
        long hostCorridorId,
        DungeonCell absoluteCell,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorAnchorBinding {
        CorridorAnchor anchor = new CorridorAnchor(
                anchorId,
                hostCorridorId,
                absoluteCell == null ? new Cell(0, 0, 0) : absoluteCell.geometry());
        anchorId = anchor.anchorId();
        hostCorridorId = anchor.hostCorridorId();
        absoluteCell = DungeonCell.fromGeometry(anchor.position());
        topologyRef = topologyRef == null || !topologyRef.present() ? DungeonTopologyRef.corridorAnchor(anchorId) : topologyRef;
    }

    public DungeonCorridorAnchorBinding withAbsoluteCell(DungeonCell nextCell) {
        CorridorAnchor moved = new CorridorAnchor(anchorId, hostCorridorId, absoluteCell.geometry())
                .withPosition(nextCell == null ? new Cell(0, 0, 0) : nextCell.geometry());
        return new DungeonCorridorAnchorBinding(
                moved.anchorId(),
                moved.hostCorridorId(),
                DungeonCell.fromGeometry(moved.position()),
                topologyRef);
    }

    public boolean matchesTopologyRef(DungeonTopologyRef ref) {
        return ref != null && ref.present() && topologyRef.equals(ref);
    }

    public CorridorAnchor toCore() {
        return new CorridorAnchor(anchorId, hostCorridorId, absoluteCell.geometry());
    }
}
