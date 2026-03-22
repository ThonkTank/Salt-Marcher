package features.world.dungeonmap.shell.editor.interaction;

public sealed interface DungeonEditorHitTarget permits DungeonEditorBoundaryHitTarget, DungeonEditorLabelHitTarget {

    String targetKey();

    DungeonEditorTargetRef targetRef();

    long priority();
}
