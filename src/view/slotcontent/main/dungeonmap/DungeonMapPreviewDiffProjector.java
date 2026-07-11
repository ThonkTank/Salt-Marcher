package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame;

final class DungeonMapPreviewDiffProjector {
    private final DungeonMapPreviewAreaDiffProjector areaProjector = new DungeonMapPreviewAreaDiffProjector();
    private final DungeonMapPreviewBoundaryDiffProjector boundaryProjector = new DungeonMapPreviewBoundaryDiffProjector();
    private final DungeonMapPreviewHandleDiffProjector handleProjector = new DungeonMapPreviewHandleDiffProjector();
    private final DungeonMapPreviewFeatureDiffProjector featureProjector = new DungeonMapPreviewFeatureDiffProjector();

    void addPreviewRenderDiff(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonMapRenderState.Label> labels,
            List<DungeonMapRenderState.Marker> markers,
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapRoomLabelPlanner roomLabelPlanner
    ) {
        PreviewRenderDiffFrame safePreviewRenderDiff = previewRenderDiff == null
                ? PreviewRenderDiffFrame.empty()
                : previewRenderDiff;
        if (safePreviewRenderDiff.isEmpty()) {
            return;
        }
        areaProjector.addPreviewAreaDiff(
                cells,
                labels,
                safePreviewRenderDiff.changedAreas(),
                selection,
                roomLabelPlanner);
        areaProjector.addPreviewAreaDiff(
                cells,
                labels,
                safePreviewRenderDiff.removedAreas(),
                selection,
                roomLabelPlanner);
        boundaryProjector.addPreviewBoundaryDiff(edges, safePreviewRenderDiff.changedBoundaries(), selection);
        boundaryProjector.addPreviewBoundaryDiff(edges, safePreviewRenderDiff.removedBoundaries(), selection);
        handleProjector.addPreviewHandleDiff(markers, safePreviewRenderDiff.changedHandles(), interactionFrame, selection);
        handleProjector.addPreviewHandleDiff(markers, safePreviewRenderDiff.removedHandles(), interactionFrame, selection);
        featureProjector.addPreviewFeatureDiff(cells, labels, markers, safePreviewRenderDiff.changedFeatures(), selection);
        featureProjector.addPreviewFeatureDiff(cells, labels, markers, safePreviewRenderDiff.removedFeatures(), selection);
    }
}
