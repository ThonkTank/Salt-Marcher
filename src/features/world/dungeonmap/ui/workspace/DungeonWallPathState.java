package features.world.dungeonmap.ui.workspace;

import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonClusterVertexRef;

import java.util.List;

public record DungeonWallPathState(
        DungeonClusterVertexRef activeAnchor,
        List<DungeonClusterEdgeRef> previewPath,
        boolean commitPending,
        DungeonClusterVertexRef pendingAnchor
) {
}
