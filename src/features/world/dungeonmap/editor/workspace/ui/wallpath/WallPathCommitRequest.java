package features.world.dungeonmap.editor.workspace.ui.wallpath;

import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.rooms.model.DungeonClusterVertexRef;

import java.util.Set;

public record WallPathCommitRequest(
        Set<DungeonClusterEdgeRef> edgeRefs,
        DungeonClusterVertexRef nextAnchor
) {
}
