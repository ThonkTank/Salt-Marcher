package features.world.quarantine.dungeonmap.canvas.state;

import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasBounds;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopology;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

public record DungeonWorkspaceRenderState(
        DungeonLayout layout,
        DungeonLayoutRenderData renderData,
        DungeonCanvasBounds bounds
) {
    public static DungeonWorkspaceRenderState from(
            DungeonLayout layout,
            CorridorTopology corridorTopology,
            DungeonWorkspaceRenderState previousState
    ) {
        return DungeonWorkspaceRenderStateFactory.create(layout, corridorTopology, previousState);
    }
}
