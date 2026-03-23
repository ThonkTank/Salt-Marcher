package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.application.runtime.DungeonHeading;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.state.DungeonLevelOverlaySettings;

public record DungeonRenderState(
        String selectedTargetKey,
        TileShape previewPaintShape,
        boolean previewPaintDeleteMode,
        int projectionLevel,
        DungeonLevelOverlaySettings levelOverlaySettings,
        DungeonRuntimeLocation activeLocation,
        DungeonHeading heading
) {
    public DungeonRenderState {
        previewPaintShape = previewPaintShape == null ? TileShape.empty() : previewPaintShape;
        levelOverlaySettings = levelOverlaySettings == null ? DungeonLevelOverlaySettings.defaults() : levelOverlaySettings;
        heading = heading == null ? DungeonHeading.defaultHeading() : heading;
    }

    public static DungeonRenderState empty() {
        return new DungeonRenderState(null, TileShape.empty(), false, 0, DungeonLevelOverlaySettings.defaults(), null, DungeonHeading.defaultHeading());
    }
}
