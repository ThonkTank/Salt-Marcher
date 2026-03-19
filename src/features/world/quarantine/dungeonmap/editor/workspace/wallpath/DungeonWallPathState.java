package features.world.quarantine.dungeonmap.editor.workspace.wallpath;

import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;

import java.util.List;

public record DungeonWallPathState(
        DungeonClusterVertexRef activeAnchor,
        List<DungeonClusterEdgeRef> previewPath,
        boolean commitPending,
        DungeonClusterVertexRef pendingAnchor
) {
}
