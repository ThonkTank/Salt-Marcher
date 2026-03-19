package features.world.quarantine.dungeonmap.editor.workspace.wallpath;

import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;

import java.util.Set;

public record WallPathCommitRequest(
        Set<DungeonClusterEdgeRef> edgeRefs,
        DungeonClusterVertexRef nextAnchor
) {
}
