package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonClusterEdgeRef;

import java.util.Set;

public record WallPathCommitRequest(
        Set<DungeonClusterEdgeRef> edgeRefs,
        DungeonClusterEdgeRef nextAnchor
) {
}
