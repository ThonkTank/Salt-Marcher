package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonLayout;

final class DungeonWorkspaceRenderStateFactory {

    private DungeonWorkspaceRenderStateFactory() {
    }

    static DungeonWorkspaceRenderState create(DungeonLayout layout) {
        return create(layout, null);
    }

    static DungeonWorkspaceRenderState create(
            DungeonLayout layout,
            DungeonWorkspaceRenderState previousState
    ) {
        if (layout == null) {
            return new DungeonWorkspaceRenderState(null, null, DungeonCanvasBounds.defaultBounds());
        }
        if (previousState != null && previousState.layout() == layout) {
            return previousState;
        }
        DungeonLayoutRenderData renderData = DungeonLayoutRenderData.from(layout);
        return new DungeonWorkspaceRenderState(layout, renderData, DungeonCanvasBounds.forLayout(layout, renderData));
    }
}
