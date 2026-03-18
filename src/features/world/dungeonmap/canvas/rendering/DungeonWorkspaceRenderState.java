package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.layout.model.DungeonLayout;

public record DungeonWorkspaceRenderState(
        DungeonLayout layout,
        DungeonLayoutRenderData renderData,
        DungeonCanvasBounds bounds
) {
    public static DungeonWorkspaceRenderState from(DungeonLayout layout) {
        return DungeonWorkspaceRenderStateFactory.create(layout);
    }

    public static DungeonWorkspaceRenderState from(
            DungeonLayout layout,
            DungeonWorkspaceRenderState previousState
    ) {
        return DungeonWorkspaceRenderStateFactory.create(layout, previousState);
    }
}
