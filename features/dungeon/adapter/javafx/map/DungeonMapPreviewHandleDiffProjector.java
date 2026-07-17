package features.dungeon.adapter.javafx.map;

import java.util.List;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorStateSnapshot;

final class DungeonMapPreviewHandleDiffProjector {

    void addPreviewHandleDiff(
            List<DungeonMapRenderState.Marker> markers,
            List<PreviewHandleDiffFrame> handles,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (PreviewHandleDiffFrame handle : handles) {
            markers.add(previewHandleMarker(handle, selection));
        }
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
