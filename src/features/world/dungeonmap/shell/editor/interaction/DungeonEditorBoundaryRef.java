package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;

public record DungeonEditorBoundaryRef(Long clusterId, Point2i cell, Point2i direction) {
}
