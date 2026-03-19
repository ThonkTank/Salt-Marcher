package features.world.quarantine.dungeonmap.canvas.state;

import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasBounds;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopology;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

final class DungeonWorkspaceRenderStateFactory {

    private DungeonWorkspaceRenderStateFactory() {
        throw new AssertionError("No instances");
    }

    static DungeonWorkspaceRenderState create(
            DungeonLayout layout,
            CorridorTopology corridorTopology,
            DungeonWorkspaceRenderState previousState
    ) {
        if (layout == null) {
            return new DungeonWorkspaceRenderState(null, null, DungeonCanvasBounds.defaultBounds());
        }
        if (previousState != null && previousState.layout() == layout) {
            return previousState;
        }
        DungeonLayoutRenderData renderData = DungeonLayoutRenderData.from(layout, corridorTopology);
        return new DungeonWorkspaceRenderState(layout, renderData, DungeonCanvasBounds.forLayout(layout, renderData));
    }
}
