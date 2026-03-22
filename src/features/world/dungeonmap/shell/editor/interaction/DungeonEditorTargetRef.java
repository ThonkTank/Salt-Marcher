package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;

public sealed interface DungeonEditorTargetRef permits DungeonEditorTargetRef.BoundaryRef, DungeonEditorTargetRef.ClusterRef {

    record ClusterRef(Long clusterId) implements DungeonEditorTargetRef {
    }

    record BoundaryRef(Long clusterId, Point2i cell, Point2i direction) implements DungeonEditorTargetRef {
    }
}
