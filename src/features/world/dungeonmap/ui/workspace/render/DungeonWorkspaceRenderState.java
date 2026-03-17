package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonLayout;

public record DungeonWorkspaceRenderState(
        DungeonLayout layout,
        DungeonLayoutRenderData renderData,
        DungeonCanvasBounds bounds
) {
    public static DungeonWorkspaceRenderState from(DungeonLayout layout) {
        if (layout == null) {
            return new DungeonWorkspaceRenderState(null, null, DungeonCanvasBounds.defaultBounds());
        }
        DungeonLayoutRenderData renderData = DungeonLayoutRenderData.from(layout);
        return new DungeonWorkspaceRenderState(layout, renderData, DungeonCanvasBounds.forLayout(layout, renderData));
    }
}
