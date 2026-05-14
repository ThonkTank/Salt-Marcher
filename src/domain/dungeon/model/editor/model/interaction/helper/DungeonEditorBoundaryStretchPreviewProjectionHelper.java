package src.domain.dungeon.model.editor.model.interaction.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorProjectionElementProjectionHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorProjectionGeometryProjectionHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorProjectionIndexProjectionHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorProjectionSelectionProjectionHelper;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryStretchPreviewProjectionHelper {

    private DungeonEditorBoundaryStretchPreviewProjectionHelper() {
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
                    .map(cell -> DungeonEditorProjectionElementProjectionHelper.cell(
                            area,
                            cell,
                            DungeonEditorProjectionSelectionProjectionHelper.selectedArea(area, selection),
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
                DungeonEditorProjectionIndexProjectionHelper.clusterLabelHandle(handles, clusterId);
        if (previewHandle != null) {
            labels.add(DungeonEditorProjectionElementProjectionHelper.clusterLabel(previewHandle, true, true, 0, 0, 0));
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
                    || !DungeonEditorProjectionGeometryProjectionHelper.edgeTouchesAnyCell(boundary.edge(), previewClusterCells)) {
                continue;
            }
            edges.add(DungeonEditorProjectionElementProjectionHelper.edge(boundary, 0, 0, 0, true, false));
        }
    }
}
