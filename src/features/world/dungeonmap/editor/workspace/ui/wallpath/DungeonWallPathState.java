package features.world.dungeonmap.editor.workspace.ui.wallpath;

import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.rooms.model.DungeonClusterVertexRef;

import java.util.List;

public record DungeonWallPathState(
        DungeonClusterVertexRef activeAnchor,
        List<DungeonClusterEdgeRef> previewPath,
        boolean commitPending,
        DungeonClusterVertexRef pendingAnchor
) {
}
