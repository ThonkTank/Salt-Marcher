package src.domain.dungeoneditor.model.interaction.helper;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorClusterMovePreviewProjectionHelper {

    private DungeonEditorClusterMovePreviewProjectionHelper() {
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
            if (!DungeonEditorProjectionSelectionProjectionHelper.draggedClusterArea(area, selection, movePreview)) {
                continue;
            }
            List<DungeonEditorMapProjectionSnapshot.CellProjection> previewCells = area.cells().stream()
                    .map(cell -> DungeonEditorProjectionElementProjectionHelper.cell(
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
                DungeonEditorProjectionIndexProjectionHelper.clusterLabelHandle(handles, movePreview.handleRef().clusterId());
        if (clusterLabelHandle != null) {
            labels.add(DungeonEditorProjectionElementProjectionHelper.clusterLabel(
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
                    || !DungeonEditorProjectionGeometryProjectionHelper.edgeTouchesAnyCell(boundary.edge(), draggedCells)) {
                continue;
            }
            edges.add(DungeonEditorProjectionElementProjectionHelper.edge(
                    boundary,
                    movePreview.deltaQ(),
                    movePreview.deltaR(),
                    movePreview.deltaLevel(),
                    true,
                    false));
        }
    }
}
