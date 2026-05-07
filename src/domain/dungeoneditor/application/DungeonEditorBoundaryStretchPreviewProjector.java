package src.domain.dungeoneditor.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryStretchPreviewProjector {

    private DungeonEditorBoundaryStretchPreviewProjector() {
    }

    public static void addBoundaryStretchPreview(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot previewMap,
            DungeonEditorSessionValues.MoveBoundaryStretchPreview movePreview
    ) {
        if (previewMap == null) {
            return;
        }
        List<DungeonEditorWorkspaceValues.Area> previewAreas = previewAreas(previewMap, movePreview.clusterId());
        if (previewAreas.isEmpty()) {
            return;
        }
        previewAreas(cells, previewAreas, selection);
        previewClusterLabel(labels, previewMap.editorHandles(), movePreview.clusterId());
        previewBoundaries(edges, previewMap.boundaries(), previewClusterCells(previewAreas));
    }

    private static List<DungeonEditorWorkspaceValues.Area> previewAreas(
            DungeonEditorWorkspaceValues.MapSnapshot previewMap,
            long clusterId
    ) {
        return previewMap.areas().stream()
                .filter(area -> area.kind().isRoom() && area.clusterId() == clusterId)
                .toList();
    }

    private static void previewAreas(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorWorkspaceValues.Area> previewAreas,
            DungeonEditorSessionValues.Selection selection
    ) {
        for (DungeonEditorWorkspaceValues.Area area : previewAreas) {
            area.cells().stream()
                    .map(cell -> DungeonEditorProjectionElementProjector.cell(
                            area,
                            cell,
                            DungeonEditorProjectionSelectionProjector.selectedArea(area, selection),
                            true,
                            0,
                            0,
                            0))
                    .forEach(cells::add);
        }
    }

    private static List<DungeonEditorWorkspaceValues.Cell> previewClusterCells(
            List<DungeonEditorWorkspaceValues.Area> previewAreas
    ) {
        return previewAreas.stream()
                .flatMap(area -> area.cells().stream())
                .toList();
    }

    private static void previewClusterLabel(
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            long clusterId
    ) {
        DungeonEditorWorkspaceValues.Handle previewHandle =
                DungeonEditorProjectionIndexProjector.clusterLabelHandle(handles, clusterId);
        if (previewHandle != null) {
            labels.add(DungeonEditorProjectionElementProjector.clusterLabel(previewHandle, true, true, 0, 0, 0));
        }
    }

    private static void previewBoundaries(
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorWorkspaceValues.Boundary> boundaries,
            List<DungeonEditorWorkspaceValues.Cell> previewClusterCells
    ) {
        for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries) {
            if (boundary.edge() == null
                    || boundary.edge().from() == null
                    || boundary.edge().to() == null
                    || !DungeonEditorProjectionGeometryProjector.edgeTouchesAnyCell(boundary.edge(), previewClusterCells)) {
                continue;
            }
            edges.add(DungeonEditorProjectionElementProjector.edge(boundary, 0, 0, 0, true, false));
        }
    }
}
