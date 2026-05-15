package src.domain.dungeon.model.editor.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.helper.DungeonEditorBoundaryStretchPreviewProjectionHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorClusterMovePreviewProjectionHelper;
import src.domain.dungeon.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionPreviewProjectionHelper {

    private DungeonEditorProjectionPreviewProjectionHelper() {
    }

    public static void addEditorPreview(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorWorkspaceValues.Area> areas,
            List<DungeonEditorWorkspaceValues.Boundary> boundaries,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview,
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot previewMap
    ) {
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview movePreview) {
            addClusterMovePreview(cells, edges, labels, areas, boundaries, handles, selection, movePreview);
        } else if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview roomRectangle) {
            addRoomRectanglePreview(cells, roomRectangle);
        } else if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaryEdges) {
            addBoundaryEdgesPreview(edges, boundaryEdges);
        } else if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview boundaryStretchMove) {
            DungeonEditorBoundaryStretchPreviewProjectionHelper.addBoundaryStretchPreview(
                    cells,
                    edges,
                    labels,
                    selection,
                    previewMap,
                    boundaryStretchMove);
        }
    }

    public static void addHandleMovePreview(
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.MoveHandlePreview movePreview)
                || movePreview.handleRef().kind().isClusterLabel()) {
            return;
        }
        DungeonEditorWorkspaceValues.HandleRef ref = movePreview.handleRef();
        DungeonEditorWorkspaceValues.Cell cell = ref.cell();
        DungeonEditorWorkspaceValues.Cell movedCell = new DungeonEditorWorkspaceValues.Cell(
                cell.q() + movePreview.deltaQ(),
                cell.r() + movePreview.deltaR(),
                cell.level() + movePreview.deltaLevel());
        DungeonEditorWorkspaceValues.HandleRef movedRef = new DungeonEditorWorkspaceValues.HandleRef(
                ref.kind(),
                ref.topologyRef(),
                ref.ownerId(),
                ref.clusterId(),
                ref.corridorId(),
                ref.roomId(),
                ref.index(),
                movedCell,
                ref.direction());
        markers.add(new DungeonEditorMapProjectionSnapshot.MarkerProjection(
                DungeonEditorProjectionElementProjectionHelper.handleMarkerLabel(ref.kind()),
                movedCell.q() + 0.5,
                movedCell.r() + 0.5,
                movedCell.level(),
                DungeonEditorProjectionElementProjectionHelper.handleMarkerKind(ref.kind()),
                true,
                DungeonEditorPublishedValueProjectionHelper.toPublishedHandleRefOrEmpty(movedRef),
                true));
    }

    public static void addBoundaryEdgesPreview(
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            DungeonEditorSessionValues.ClusterBoundariesPreview boundaryEdges
    ) {
        DungeonEditorMapProjectionSnapshot.EdgeKind kind = boundaryEdges.boundaryKind().isDoor()
                ? DungeonEditorMapProjectionSnapshot.EdgeKind.DOOR
                : DungeonEditorMapProjectionSnapshot.EdgeKind.WALL;
        for (DungeonEditorWorkspaceValues.Edge edge : boundaryEdges.edges()) {
            if (edge == null || edge.from() == null || edge.to() == null) {
                continue;
            }
            edges.add(new DungeonEditorMapProjectionSnapshot.EdgeProjection(
                    edge.from().q(),
                    edge.from().r(),
                    edge.to().q(),
                    edge.to().r(),
                    edge.from().level(),
                    kind,
                    boundaryEdges.deleteMode() ? "Delete preview" : "Boundary preview",
                    boundaryEdges.clusterId(),
                    DungeonEditorTopologyElementRef.empty(),
                    false,
                    true));
        }
    }

    private static void addRoomRectanglePreview(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            DungeonEditorSessionValues.RoomRectanglePreview roomRectangle
    ) {
        int minQ = Math.min(roomRectangle.start().q(), roomRectangle.end().q());
        int maxQ = Math.max(roomRectangle.start().q(), roomRectangle.end().q());
        int minR = Math.min(roomRectangle.start().r(), roomRectangle.end().r());
        int maxR = Math.max(roomRectangle.start().r(), roomRectangle.end().r());
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                cells.add(new DungeonEditorMapProjectionSnapshot.CellProjection(
                        q,
                        r,
                        roomRectangle.start().level(),
                        roomRectangle.deleteMode() ? "Delete preview" : "Paint preview",
                        DungeonEditorMapProjectionSnapshot.CellKind.ROOM,
                        0L,
                        0L,
                        DungeonEditorTopologyElementRef.empty(),
                        false,
                        false,
                        true,
                        roomRectangle.deleteMode()));
            }
        }
    }

    private static void addClusterMovePreview(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorWorkspaceValues.Area> areas,
            List<DungeonEditorWorkspaceValues.Boundary> boundaries,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.MoveHandlePreview movePreview
    ) {
        if (!movePreview.handleRef().kind().isClusterLabel()) {
            return;
        }
        DungeonEditorClusterMovePreviewProjectionHelper.addClusterMovePreview(
                cells,
                edges,
                labels,
                areas,
                boundaries,
                handles,
                selection,
                movePreview);
    }
}
