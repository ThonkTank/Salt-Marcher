package features.world.dungeonmap.shell.editor.interaction;

public sealed interface DungeonEditorHitTarget
        permits DungeonEditorBoundaryHitTarget,
        DungeonEditorConnectionHitTarget,
        DungeonEditorCorridorCornerHitTarget,
        DungeonEditorCorridorNodeHitTarget,
        DungeonEditorCorridorSegmentHitTarget,
        DungeonEditorFloorCellHitTarget,
        DungeonEditorLabelHitTarget,
        DungeonEditorRoomBoundaryHitTarget,
        DungeonEditorRoomHitTarget {

    String targetKey();

    default Long clusterId() {
        return null;
    }

    default Long roomId() {
        return null;
    }

    long priority();
}
