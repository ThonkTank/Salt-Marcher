package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorPreview;

import java.util.Set;

public record DungeonEditorRenderState(
        DungeonSelectionKey selectedKey,
        EditorHover hovered,
        DungeonLayout previewLayout,
        StructureObject paintPreviewStructure,
        int paintPreviewLevelZ,
        boolean paintPreviewDeleteMode,
        Set<GridSegment2x> boundaryPreviewEdges,
        Set<GridSegment2x> boundaryPreviewSkippedEdges,
        GridPoint2x boundaryPreviewStartVertex2x,
        GridPoint2x boundaryPreviewCurrentVertex2x,
        boolean boundaryPreviewDeleteMode
) {
    public DungeonEditorRenderState {
        paintPreviewStructure = paintPreviewStructure == null ? StructureObject.empty() : paintPreviewStructure;
        boundaryPreviewEdges = boundaryPreviewEdges == null ? Set.of() : Set.copyOf(boundaryPreviewEdges);
        boundaryPreviewSkippedEdges = boundaryPreviewSkippedEdges == null ? Set.of() : Set.copyOf(boundaryPreviewSkippedEdges);
    }

    public static DungeonEditorRenderState from(DungeonSelectionKey selectedKey, EditorHover hovered, EditorPreview preview) {
        if (preview instanceof EditorPreview.LayoutPreview layoutPreview) {
            return new DungeonEditorRenderState(
                    selectedKey,
                    hovered,
                    layoutPreview.layout(),
                    StructureObject.empty(),
                    0,
                    false,
                    Set.of(),
                    Set.of(),
                    null,
                    null,
                    false);
        }
        if (preview instanceof EditorPreview.PaintPreview paintPreview) {
            return new DungeonEditorRenderState(
                    selectedKey,
                    hovered,
                    null,
                    paintPreview.structure(),
                    paintPreview.levelZ(),
                    paintPreview.deleteMode(),
                    Set.of(),
                    Set.of(),
                    null,
                    null,
                    false);
        }
        if (preview instanceof EditorPreview.BoundaryPreview boundaryPreview) {
            return new DungeonEditorRenderState(
                    selectedKey,
                    hovered,
                    null,
                    StructureObject.empty(),
                    0,
                    false,
                    boundaryPreview.edges(),
                    boundaryPreview.skippedConnectionEdges(),
                    boundaryPreview.startVertex2x(),
                    boundaryPreview.currentVertex2x(),
                    boundaryPreview.deleteMode());
        }
        return new DungeonEditorRenderState(
                selectedKey,
                hovered,
                null,
                StructureObject.empty(),
                0,
                false,
                Set.of(),
                Set.of(),
                null,
                null,
                false);
    }

    public static DungeonEditorRenderState empty() {
        return new DungeonEditorRenderState(
                null,
                null,
                null,
                StructureObject.empty(),
                0,
                false,
                Set.of(),
                Set.of(),
                null,
                null,
                false);
    }
}
