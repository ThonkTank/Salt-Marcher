package features.dungeon.adapter.javafx.map;

import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.DungeonEditorSurface;
import features.dungeon.application.editor.DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame;
import features.dungeon.application.editor.DungeonEditorPreparedFrameFacts.PreviewRenderFrame;

final class DungeonMapEditorRenderProjector {
    private final DungeonMapRoomLabelPlanner roomLabelPlanner;
    private final DungeonMapPreviewDiffProjector previewDiffProjector = new DungeonMapPreviewDiffProjector();

    DungeonMapEditorRenderProjector(DungeonMapRoomLabelPlanner roomLabelPlanner) {
        this.roomLabelPlanner = roomLabelPlanner;
    }

    DungeonMapRenderState project(
            String placeholderTitle,
            @Nullable DungeonEditorSurface surface,
            DungeonEditorStateSnapshot.Selection selection,
            PreviewRenderFrame previewRender,
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            boolean editorMode
    ) {
        if (surface == null) {
            return DungeonMapRenderState.empty(placeholderTitle, editorMode);
        }
        DungeonEditorMapSnapshot map = surface.map();
        DungeonMapEditorProjectionAccumulator projection = assemble(
                map,
                previewRender == null ? PreviewRenderFrame.empty() : previewRender,
                previewRenderDiff,
                selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection,
                interactionFrame == null ? DungeonMapContentModel.MapInteractionFrame.empty() : interactionFrame);
        return projection.renderState(surface, map, editorMode);
    }

    private DungeonMapEditorProjectionAccumulator assemble(
            DungeonEditorMapSnapshot map,
            PreviewRenderFrame previewRender,
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapContentModel.MapInteractionFrame interactionFrame
    ) {
        DungeonMapEditorProjectionAccumulator projection = new DungeonMapEditorProjectionAccumulator(roomLabelPlanner, previewDiffProjector);
        projection.addAreas(map, selection);
        projection.addClusterLabels(map, selection);
        projection.addPreviewAndBoundaries(map, selection, previewRender);
        projection.addFeatures(map, selection);
        projection.addHandles(map, selection, interactionFrame);
        projection.addPreviewRenderDiff(previewRenderDiff, selection, interactionFrame);
        projection.addFallbackGraphLinks();
        return projection;
    }
}
