package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.state.EditorHover;

import java.util.Set;

public record DungeonEditorRenderState(
        String selectedTargetKey,
        EditorHover hovered,
        DungeonLayout previewLayout,
        TileShape paintPreviewShape,
        boolean paintPreviewDeleteMode,
        Set<VertexEdge> boundaryPreviewEdges,
        Set<VertexEdge> boundaryPreviewSkippedEdges,
        Point2i boundaryPreviewStartVertex,
        Point2i boundaryPreviewCurrentVertex,
        boolean boundaryPreviewDeleteMode
) {
    public DungeonEditorRenderState {
        paintPreviewShape = paintPreviewShape == null ? TileShape.empty() : paintPreviewShape;
        boundaryPreviewEdges = boundaryPreviewEdges == null ? Set.of() : Set.copyOf(boundaryPreviewEdges);
        boundaryPreviewSkippedEdges = boundaryPreviewSkippedEdges == null ? Set.of() : Set.copyOf(boundaryPreviewSkippedEdges);
    }

    public static DungeonEditorRenderState empty() {
        return new DungeonEditorRenderState(
                null,
                null,
                null,
                TileShape.empty(),
                false,
                Set.of(),
                Set.of(),
                null,
                null,
                false);
    }
}
