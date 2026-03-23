package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;

public sealed interface DungeonEditorTargetRef permits DungeonEditorTargetRef.BoundaryRef, DungeonEditorTargetRef.ClusterRef, DungeonEditorTargetRef.StairRef {

    record ClusterRef(Long clusterId) implements DungeonEditorTargetRef {
    }

    record BoundaryRef(Long clusterId, Point2i cell, Point2i direction) implements DungeonEditorTargetRef {
    }

    record StairRef(Long stairId) implements DungeonEditorTargetRef {
    }
}
