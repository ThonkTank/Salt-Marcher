package features.world.dungeonmap.shell.editor.interaction;

public sealed interface DungeonEditorHitTarget permits DungeonEditorBoundaryHitTarget, DungeonEditorLabelHitTarget, DungeonEditorRoomHitTarget {

    String targetKey();

    Long clusterId();

    default Long roomId() {
        return null;
    }

    long priority();
}
