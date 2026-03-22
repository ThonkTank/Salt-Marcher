package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.application.runtime.DungeonHeading;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.geometry.TileShape;

public record DungeonRenderState(
        String selectedTargetKey,
        TileShape previewPaintShape,
        boolean previewPaintDeleteMode,
        DungeonRuntimeLocation activeLocation,
        DungeonHeading heading
) {
    public DungeonRenderState {
        previewPaintShape = previewPaintShape == null ? TileShape.empty() : previewPaintShape;
        heading = heading == null ? DungeonHeading.defaultHeading() : heading;
    }

    public static DungeonRenderState empty() {
        return new DungeonRenderState(null, TileShape.empty(), false, null, DungeonHeading.defaultHeading());
    }
}
