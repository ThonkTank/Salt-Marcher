package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.state.DungeonLevelOverlaySettings;

import java.util.Set;

public record DungeonRenderState(
        String selectedTargetKey,
        features.world.dungeonmap.shell.interaction.DungeonSelectionKey hoveredSelectionKey,
        TileShape previewPaintShape,
        boolean previewPaintDeleteMode,
        Set<VertexEdge> previewBoundaryEdges,
        Set<VertexEdge> previewBoundarySkippedEdges,
        Point2i previewBoundaryStartVertex,
        Point2i previewBoundaryCurrentVertex,
        boolean previewBoundaryDeleteMode,
        int projectionLevel,
        DungeonLevelOverlaySettings levelOverlaySettings,
        DungeonRuntimeLocation activeLocation,
        CardinalDirection heading
) {
    public DungeonRenderState {
        previewPaintShape = previewPaintShape == null ? TileShape.empty() : previewPaintShape;
        previewBoundaryEdges = previewBoundaryEdges == null ? Set.of() : Set.copyOf(previewBoundaryEdges);
        previewBoundarySkippedEdges = previewBoundarySkippedEdges == null ? Set.of() : Set.copyOf(previewBoundarySkippedEdges);
        levelOverlaySettings = levelOverlaySettings == null ? DungeonLevelOverlaySettings.defaults() : levelOverlaySettings;
        heading = heading == null ? CardinalDirection.defaultDirection() : heading;
    }

    public static DungeonRenderState empty() {
        return new DungeonRenderState(
                null,
                null,
                TileShape.empty(),
                false,
                Set.of(),
                Set.of(),
                null,
                null,
                false,
                0,
                DungeonLevelOverlaySettings.defaults(),
                null,
                CardinalDirection.defaultDirection());
    }
}
