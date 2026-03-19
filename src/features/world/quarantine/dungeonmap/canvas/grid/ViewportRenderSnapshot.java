package features.world.quarantine.dungeonmap.canvas.grid;

import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;

public record ViewportRenderSnapshot(
        DungeonLayout layout,
        DungeonLayoutRenderData renderData,
        DungeonCanvasCamera camera,
        DungeonSelection selection,
        DungeonRuntimeLocation activeLocation,
        Long hoveredCorridorId
) {
}
