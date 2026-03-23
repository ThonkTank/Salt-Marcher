package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.application.runtime.DungeonHeading;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.List;

public record DungeonRenderState(
        String selectedTargetKey,
        TileShape previewPaintShape,
        boolean previewPaintDeleteMode,
        List<CubePoint> previewStairPath,
        int projectionLevel,
        DungeonRuntimeLocation activeLocation,
        DungeonHeading heading
) {
    public DungeonRenderState {
        previewPaintShape = previewPaintShape == null ? TileShape.empty() : previewPaintShape;
        previewStairPath = previewStairPath == null ? List.of() : List.copyOf(previewStairPath);
        heading = heading == null ? DungeonHeading.defaultHeading() : heading;
    }

    public static DungeonRenderState empty() {
        return new DungeonRenderState(null, TileShape.empty(), false, List.of(), 0, null, DungeonHeading.defaultHeading());
    }
}
