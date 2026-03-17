package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.domain.model.DungeonLayout;

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
