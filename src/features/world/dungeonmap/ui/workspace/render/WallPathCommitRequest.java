package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonClusterVertexRef;

import java.util.Set;

public record WallPathCommitRequest(
        Set<DungeonClusterEdgeRef> edgeRefs,
        DungeonClusterVertexRef nextAnchor
) {
}
