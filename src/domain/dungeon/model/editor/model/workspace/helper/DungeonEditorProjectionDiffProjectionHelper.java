package src.domain.dungeon.model.editor.model.workspace.helper;

import java.util.List;
import java.util.Map;
import src.domain.dungeon.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionDiffProjectionHelper {

    private DungeonEditorProjectionDiffProjectionHelper() {
    }

    public static void addPreviewAreaDiff(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorWorkspaceValues.Area> committedAreas,
            List<DungeonEditorWorkspaceValues.Area> previewAreas,
            DungeonEditorSessionValues.Selection selection
    ) {
        Map<String, DungeonEditorWorkspaceValues.Area> committedByTopology =
                DungeonEditorProjectionIndexProjectionHelper.indexAreas(committedAreas);
        for (DungeonEditorWorkspaceValues.Area previewArea : previewAreas) {
            DungeonEditorWorkspaceValues.Area committedArea = committedByTopology.remove(
                    DungeonEditorProjectionIndexProjectionHelper.topologyKey(previewArea.topologyRef()));
            if (previewArea.equals(committedArea)) {
                continue;
            }
            addPreviewArea(cells, labels, previewArea, selection, false);
        }
        for (DungeonEditorWorkspaceValues.Area removedArea : committedByTopology.values()) {
            addPreviewArea(cells, labels, removedArea, selection, true);
        }
    }

    public static void addPreviewBoundaryDiff(
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorWorkspaceValues.Boundary> committedBoundaries,
            List<DungeonEditorWorkspaceValues.Boundary> previewBoundaries,
            DungeonEditorSessionValues.Selection selection
    ) {
        Map<String, DungeonEditorWorkspaceValues.Boundary> committedByTopology =
                DungeonEditorProjectionIndexProjectionHelper.indexBoundaries(committedBoundaries);
        for (DungeonEditorWorkspaceValues.Boundary previewBoundary : previewBoundaries) {
            DungeonEditorWorkspaceValues.Boundary committedBoundary = committedByTopology.remove(
                    DungeonEditorProjectionIndexProjectionHelper.topologyKey(previewBoundary.topologyRef()));
            if (previewBoundary.equals(committedBoundary)) {
                continue;
            }
            edges.add(DungeonEditorProjectionElementProjectionHelper.edge(
                    previewBoundary,
                    0,
                    0,
                    0,
                    true,
                    DungeonEditorProjectionSelectionProjectionHelper.selectedBoundary(previewBoundary, selection)));
        }
        for (DungeonEditorWorkspaceValues.Boundary removedBoundary : committedByTopology.values()) {
            edges.add(DungeonEditorProjectionElementProjectionHelper.edge(
                    removedBoundary,
                    0,
                    0,
                    0,
                    true,
                    DungeonEditorProjectionSelectionProjectionHelper.selectedBoundary(removedBoundary, selection)));
        }
    }

    public static void addPreviewHandleDiff(
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
            List<DungeonEditorWorkspaceValues.Handle> committedHandles,
            List<DungeonEditorWorkspaceValues.Handle> previewHandles,
            DungeonEditorSessionValues.Selection selection
    ) {
        Map<String, DungeonEditorWorkspaceValues.Handle> committedByHandle =
                DungeonEditorProjectionIndexProjectionHelper.indexHandles(committedHandles);
        for (DungeonEditorWorkspaceValues.Handle previewHandle : previewHandles) {
            if (previewHandle.ref().kind().isClusterLabel()) {
                continue;
            }
            DungeonEditorWorkspaceValues.Handle committedHandle = committedByHandle.remove(
                    DungeonEditorProjectionIndexProjectionHelper.handleKey(previewHandle.ref()));
            if (previewHandle.equals(committedHandle)) {
                continue;
            }
            markers.add(DungeonEditorProjectionElementProjectionHelper.handleMarker(previewHandle, selection, true));
        }
        for (DungeonEditorWorkspaceValues.Handle removedHandle : committedByHandle.values()) {
            if (removedHandle.ref().kind().isClusterLabel()) {
                continue;
            }
            markers.add(DungeonEditorProjectionElementProjectionHelper.handleMarker(removedHandle, selection, true));
        }
    }

    private static void addPreviewArea(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            DungeonEditorWorkspaceValues.Area area,
            DungeonEditorSessionValues.Selection selection,
            boolean destructive
    ) {
        boolean selected = DungeonEditorProjectionSelectionProjectionHelper.selectedArea(area, selection);
        List<DungeonEditorMapProjectionSnapshot.CellProjection> previewCells = area.cells().stream()
                .map(cell -> new DungeonEditorMapProjectionSnapshot.CellProjection(
                        cell.q(),
                        cell.r(),
                        cell.level(),
                        area.label(),
                        area.kind().isCorridor()
                                ? DungeonEditorMapProjectionSnapshot.CellKind.CORRIDOR
                                : DungeonEditorMapProjectionSnapshot.CellKind.ROOM,
                        area.id(),
                        area.clusterId(),
                        DungeonEditorProjectionPublishedBoundaryTranslationHelper.safeTopologyRef(area.topologyRef()),
                        selected,
                        false,
                        true,
                        destructive))
                .toList();
        cells.addAll(previewCells);
        if (previewCells.isEmpty()) {
            return;
        }
        DungeonEditorProjectionGeometryProjectionHelper.CellCenter center =
                DungeonEditorProjectionGeometryProjectionHelper.centerOf(previewCells);
        labels.add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                area.label(),
                center.q(),
                center.r(),
                previewCells.getFirst().level(),
                area.id(),
                area.clusterId(),
                DungeonEditorProjectionPublishedBoundaryTranslationHelper.safeTopologyRef(area.topologyRef()),
                selected,
                true));
    }
}
