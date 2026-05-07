package src.domain.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorClusterMovePreviewProjector {

    private DungeonEditorClusterMovePreviewProjector() {
    }

    public static void addClusterMovePreview(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorWorkspaceValues.Area> areas,
            List<DungeonEditorWorkspaceValues.Boundary> boundaries,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.MoveHandlePreview movePreview
    ) {
        List<DungeonEditorWorkspaceValues.Cell> draggedCells = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Area area : areas) {
            if (!DungeonEditorProjectionSelectionProjector.draggedClusterArea(area, selection, movePreview)) {
                continue;
            }
            List<DungeonEditorMapProjectionSnapshot.CellProjection> previewCells = area.cells().stream()
                    .map(cell -> DungeonEditorProjectionElementProjector.cell(
                            area,
                            cell,
                            true,
                            true,
                            movePreview.deltaQ(),
                            movePreview.deltaR(),
                            movePreview.deltaLevel()))
                    .toList();
            cells.addAll(previewCells);
            draggedCells.addAll(area.cells());
        }
        previewClusterLabel(labels, handles, movePreview);
        previewClusterBoundaries(edges, boundaries, draggedCells, movePreview);
    }

    private static void previewClusterLabel(
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            DungeonEditorSessionValues.MoveHandlePreview movePreview
    ) {
        DungeonEditorWorkspaceValues.Handle clusterLabelHandle =
                DungeonEditorProjectionIndexProjector.clusterLabelHandle(handles, movePreview.handleRef().clusterId());
        if (clusterLabelHandle != null) {
            labels.add(DungeonEditorProjectionElementProjector.clusterLabel(
                    clusterLabelHandle,
                    true,
                    true,
                    movePreview.deltaQ(),
                    movePreview.deltaR(),
                    movePreview.deltaLevel()));
        }
    }

    private static void previewClusterBoundaries(
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorWorkspaceValues.Boundary> boundaries,
            List<DungeonEditorWorkspaceValues.Cell> draggedCells,
            DungeonEditorSessionValues.MoveHandlePreview movePreview
    ) {
        if (draggedCells.isEmpty()) {
            return;
        }
        for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries) {
            if (boundary.edge() == null
                    || boundary.edge().from() == null
                    || boundary.edge().to() == null
                    || !DungeonEditorProjectionGeometryProjector.edgeTouchesAnyCell(boundary.edge(), draggedCells)) {
                continue;
            }
            edges.add(DungeonEditorProjectionElementProjector.edge(
                    boundary,
                    movePreview.deltaQ(),
                    movePreview.deltaR(),
                    movePreview.deltaLevel(),
                    true,
                    false));
        }
    }
}
