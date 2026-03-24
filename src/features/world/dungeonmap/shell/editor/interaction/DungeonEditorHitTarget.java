package features.world.dungeonmap.shell.editor.interaction;

public sealed interface DungeonEditorHitTarget permits DungeonEditorBoundaryHitTarget, DungeonEditorLabelHitTarget {

    String targetKey();

    Long clusterId();

    long priority();
}
