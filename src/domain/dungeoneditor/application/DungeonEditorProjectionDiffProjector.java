package src.domain.dungeoneditor.application;

import java.util.List;
import java.util.Map;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionDiffProjector {

    private DungeonEditorProjectionDiffProjector() {
    }

    public static void addPreviewAreaDiff(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorWorkspaceValues.Area> committedAreas,
            List<DungeonEditorWorkspaceValues.Area> previewAreas,
            DungeonEditorSessionValues.Selection selection
    ) {
        Map<String, DungeonEditorWorkspaceValues.Area> committedByTopology =
                DungeonEditorProjectionIndexProjector.indexAreas(committedAreas);
        for (DungeonEditorWorkspaceValues.Area previewArea : previewAreas) {
            DungeonEditorWorkspaceValues.Area committedArea = committedByTopology.remove(
                    DungeonEditorProjectionIndexProjector.topologyKey(previewArea.topologyRef()));
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
                DungeonEditorProjectionIndexProjector.indexBoundaries(committedBoundaries);
        for (DungeonEditorWorkspaceValues.Boundary previewBoundary : previewBoundaries) {
            DungeonEditorWorkspaceValues.Boundary committedBoundary = committedByTopology.remove(
                    DungeonEditorProjectionIndexProjector.topologyKey(previewBoundary.topologyRef()));
            if (previewBoundary.equals(committedBoundary)) {
                continue;
            }
            edges.add(DungeonEditorProjectionElementProjector.edge(
                    previewBoundary,
                    0,
                    0,
                    0,
                    true,
                    DungeonEditorProjectionSelectionProjector.selectedBoundary(previewBoundary, selection)));
        }
        for (DungeonEditorWorkspaceValues.Boundary removedBoundary : committedByTopology.values()) {
            edges.add(DungeonEditorProjectionElementProjector.edge(
                    removedBoundary,
                    0,
                    0,
                    0,
                    true,
                    DungeonEditorProjectionSelectionProjector.selectedBoundary(removedBoundary, selection)));
        }
    }

    public static void addPreviewHandleDiff(
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
            List<DungeonEditorWorkspaceValues.Handle> committedHandles,
            List<DungeonEditorWorkspaceValues.Handle> previewHandles,
            DungeonEditorSessionValues.Selection selection
    ) {
        Map<String, DungeonEditorWorkspaceValues.Handle> committedByHandle =
                DungeonEditorProjectionIndexProjector.indexHandles(committedHandles);
        for (DungeonEditorWorkspaceValues.Handle previewHandle : previewHandles) {
            if (previewHandle.ref().kind().isClusterLabel()) {
                continue;
            }
            DungeonEditorWorkspaceValues.Handle committedHandle = committedByHandle.remove(
                    DungeonEditorProjectionIndexProjector.handleKey(previewHandle.ref()));
            if (previewHandle.equals(committedHandle)) {
                continue;
            }
            markers.add(DungeonEditorProjectionElementProjector.handleMarker(previewHandle, selection, true));
        }
        for (DungeonEditorWorkspaceValues.Handle removedHandle : committedByHandle.values()) {
            if (removedHandle.ref().kind().isClusterLabel()) {
                continue;
            }
            markers.add(DungeonEditorProjectionElementProjector.handleMarker(removedHandle, selection, true));
        }
    }

    private static void addPreviewArea(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            DungeonEditorWorkspaceValues.Area area,
            DungeonEditorSessionValues.Selection selection,
            boolean destructive
    ) {
        boolean selected = DungeonEditorProjectionSelectionProjector.selectedArea(area, selection);
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
                        DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(area.topologyRef()),
                        selected,
                        false,
                        true,
                        destructive))
                .toList();
        cells.addAll(previewCells);
        if (previewCells.isEmpty()) {
            return;
        }
        DungeonEditorProjectionGeometryProjector.CellCenter center =
                DungeonEditorProjectionGeometryProjector.centerOf(previewCells);
        labels.add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                area.label(),
                center.q(),
                center.r(),
                previewCells.getFirst().level(),
                area.id(),
                area.clusterId(),
                DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(area.topologyRef()),
                selected,
                true));
    }
}
