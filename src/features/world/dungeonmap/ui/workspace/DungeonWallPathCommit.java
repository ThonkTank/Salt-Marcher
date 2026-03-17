package features.world.dungeonmap.ui.workspace;

import features.world.dungeonmap.domain.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.domain.model.DungeonClusterVertexRef;

import java.util.Set;

public record DungeonWallPathCommit(
        Set<DungeonClusterEdgeRef> edgeRefs,
        DungeonClusterVertexRef nextAnchor
) {
}
