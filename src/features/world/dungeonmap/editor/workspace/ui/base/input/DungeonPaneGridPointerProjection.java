package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;

public interface DungeonPaneGridPointerProjection {

    DungeonPaneGridPointerProjection UNSUPPORTED = (screenX, screenY) -> null;

    DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY);
}
