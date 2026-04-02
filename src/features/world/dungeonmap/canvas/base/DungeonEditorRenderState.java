package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.state.EditorHover;

import java.util.Set;

public record DungeonEditorRenderState(
        String selectedTargetKey,
        EditorHover hovered,
        DungeonLayout previewLayout,
        StructureObject paintPreviewStructure,
        int paintPreviewLevelZ,
        boolean paintPreviewDeleteMode,
        Set<LegacyGridSegment2x> boundaryPreviewEdges,
        Set<LegacyGridSegment2x> boundaryPreviewSkippedEdges,
        LegacyGridPoint2x boundaryPreviewStartVertex2x,
        LegacyGridPoint2x boundaryPreviewCurrentVertex2x,
        boolean boundaryPreviewDeleteMode
) {
    public DungeonEditorRenderState {
        paintPreviewStructure = paintPreviewStructure == null ? StructureObject.empty() : paintPreviewStructure;
        boundaryPreviewEdges = boundaryPreviewEdges == null ? Set.of() : Set.copyOf(boundaryPreviewEdges);
        boundaryPreviewSkippedEdges = boundaryPreviewSkippedEdges == null ? Set.of() : Set.copyOf(boundaryPreviewSkippedEdges);
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
