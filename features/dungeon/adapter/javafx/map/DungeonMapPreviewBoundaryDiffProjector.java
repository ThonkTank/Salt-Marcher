package features.dungeon.adapter.javafx.map;

import java.util.List;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.application.editor.DungeonEditorPreparedFrameFacts.PreviewBoundaryDiffFrame;

final class DungeonMapPreviewBoundaryDiffProjector {

    void addPreviewBoundaryDiff(
            List<DungeonMapRenderState.Edge> edges,
            List<PreviewBoundaryDiffFrame> boundaries,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (PreviewBoundaryDiffFrame boundary : boundaries) {
            DungeonEdgeRef edge = boundary.edge();
            edges.add(new DungeonMapRenderState.Edge(
                    edge.from().q(),
                    edge.from().r(),
                    edge.to().q(),
                    edge.to().r(),
                    edge.from().level(),
                    DungeonMapRenderEdges.boundaryKind(boundary.kind()),
                    boundary.label(),
                    boundary.id(),
                    DungeonMapRenderElementFactory.topologyRef(boundary.topologyRef()),
                    selectedBoundary(boundary, selection),
                    true));
        }
    }

    private static boolean selectedBoundary(
            PreviewBoundaryDiffFrame boundary,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return selection != null
                && DungeonMapRenderElementFactory.topologyRef(boundary.topologyRef())
                .equals(DungeonMapRenderElementFactory.topologyRef(selection.topologyRef()));
    }
}
