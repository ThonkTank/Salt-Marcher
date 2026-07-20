package features.dungeon.adapter.javafx.map;

import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.editor.DungeonEditorSelection;
import features.dungeon.api.DungeonEditorSurface;

final class DungeonMapEditorRenderProjector {
    private final DungeonMapRoomLabelPlanner roomLabelPlanner;
    private final DungeonMapPreviewDiffProjector previewDiffProjector = new DungeonMapPreviewDiffProjector();

    DungeonMapEditorRenderProjector(DungeonMapRoomLabelPlanner roomLabelPlanner) {
        this.roomLabelPlanner = roomLabelPlanner;
    }

    DungeonMapRenderState project(
            String placeholderTitle,
            @Nullable DungeonEditorSurface surface,
            DungeonEditorSelection selection,
            DungeonEditorPreview preview,
            PreviewRenderFrame previewRender,
            PreviewRenderDiffFrame previewRenderDiff,
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
                selection == null ? DungeonEditorSelection.empty() : selection,
                preview == null ? DungeonEditorPreview.none() : preview);
        return projection.renderState(surface, map, editorMode);
    }

    private DungeonMapEditorProjectionAccumulator assemble(
            DungeonEditorMapSnapshot map,
            PreviewRenderFrame previewRender,
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonEditorSelection selection,
            DungeonEditorPreview preview
    ) {
        DungeonMapEditorProjectionAccumulator projection = new DungeonMapEditorProjectionAccumulator(roomLabelPlanner, previewDiffProjector);
        projection.addAreas(map, selection);
        projection.addClusterLabels(map, selection);
        projection.addPreviewAndBoundaries(map, selection, previewRender);
        projection.addFeatures(map, selection);
        projection.addHandles(map, selection, preview);
        projection.addPreviewRenderDiff(previewRenderDiff, selection);
        projection.addFallbackGraphLinks();
        return projection;
    }
}
