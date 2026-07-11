package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorMarkerHitRefs;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewHandleDiffFrame;

final class DungeonMapPreviewHandleDiffProjector {

    void addPreviewHandleDiff(
            List<DungeonMapRenderState.Marker> markers,
            List<PreviewHandleDiffFrame> handles,
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        DungeonMapContentModel.MapInteractionFrame safeFrame = interactionFrame == null
                ? DungeonMapContentModel.MapInteractionFrame.empty()
                : interactionFrame;
        for (PreviewHandleDiffFrame handle : handles) {
            if (!runtimePreparedPreviewHandle(handle, safeFrame)) {
                continue;
            }
            markers.add(previewHandleMarker(handle, selection));
        }
    }

    private static boolean runtimePreparedPreviewHandle(
            PreviewHandleDiffFrame handle,
            DungeonMapContentModel.MapInteractionFrame interactionFrame
    ) {
        return interactionFrame.previewHandleHitRefs()
                .contains(DungeonEditorMarkerHitRefs.marker(handle.ref(), handle.cell()).value());
    }

    private static DungeonMapRenderState.Marker previewHandleMarker(
            PreviewHandleDiffFrame handle,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return DungeonMapRenderMarkers.handleMarker(
                handle.ref(),
                handle.cell().q(),
                handle.cell().r(),
                handle.cell().level(),
                previewMarkerQ(handle),
                previewMarkerR(handle),
                DungeonMapRenderSelection.selectedHandle(handle.ref(), selection),
                true);
    }

    private static double previewMarkerQ(PreviewHandleDiffFrame handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        return sourceEdge == null
                ? handle.markerQ()
                : midpoint(sourceEdge.from().q(), sourceEdge.to().q());
    }

    private static double previewMarkerR(PreviewHandleDiffFrame handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        return sourceEdge == null
                ? handle.markerR()
                : midpoint(sourceEdge.from().r(), sourceEdge.to().r());
    }

    private static double midpoint(int first, int second) {
        return (first + second) / 2.0;
    }
}
