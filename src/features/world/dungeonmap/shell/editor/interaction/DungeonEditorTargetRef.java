package features.world.dungeonmap.shell.editor.interaction;

public sealed interface DungeonEditorTargetRef permits DungeonEditorTargetRef.ClusterRef {

    record ClusterRef(Long clusterId) implements DungeonEditorTargetRef {
    }
}
