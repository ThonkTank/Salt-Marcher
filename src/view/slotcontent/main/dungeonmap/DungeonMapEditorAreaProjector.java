package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.view.slotcontent.main.dungeonmap.DungeonMapRenderState.CellKind;

final class DungeonMapEditorAreaProjector {

    private DungeonMapEditorAreaProjector() {
    }

    static void addAreas(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            List<DungeonMapRenderState.GraphNode> graphNodes,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapRoomLabelPlanner roomLabelPlanner
    ) {
        for (DungeonEditorMapSnapshot.Area area : map.areas()) {
            addArea(
                    cells,
                    labels,
                    graphNodes,
                    area,
                    DungeonMapRenderSelection.selectedAreaSurface(area, selection),
                    DungeonMapRenderSelection.selectedArea(area, selection),
                    roomLabelPlanner);
        }
    }

    static void addClusterLabels(
            List<DungeonMapRenderState.Label> labels,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        List<Long> renderedClusterIds = new ArrayList<>();
        for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
            if (!handle.ref().kind().isClusterLabel()) {
                continue;
            }
            long clusterId = handle.ref().clusterId();
            if (clusterId <= 0L || renderedClusterIds.contains(clusterId)) {
                continue;
            }
            renderedClusterIds.add(clusterId);
            labels.add(DungeonMapRenderMarkers.clusterLabel(
                    handle,
                    DungeonMapRenderSelection.selectedClusterLabel(handle, selection),
                    false,
                    0,
                    0,
                    0));
        }
    }

    private static void addArea(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            List<DungeonMapRenderState.GraphNode> graphNodes,
            DungeonEditorMapSnapshot.Area area,
            boolean surfaceSelected,
            boolean annotationSelected,
            DungeonMapRoomLabelPlanner roomLabelPlanner
    ) {
        List<DungeonMapRenderState.Cell> areaCells = new ArrayList<>();
        for (DungeonCellRef cell : area.cells()) {
            areaCells.add(DungeonMapRenderCells.cell(
                    area,
                    cell,
                    surfaceSelected,
                    false,
                    false,
                    0,
                    0,
                    0));
        }
        cells.addAll(areaCells);
        if (areaCells.isEmpty()) {
            return;
        }
        DungeonMapRenderElementFactory.RenderCellCenter center =
                DungeonMapRenderElementFactory.centerOfCells(areaCells);
        graphNodes.add(new DungeonMapRenderState.GraphNode(
                area.id(),
                DungeonMapRenderCells.clusterId(area),
                area.label(),
                center.q(),
                center.r(),
                annotationSelected));
        if (areaCells.getFirst().kind() == CellKind.ROOM) {
            labels.add(DungeonMapRenderElementFactory.roomLabel(
                    area,
                    areaCells,
                    roomLabelPlanner,
                    annotationSelected,
                    false));
        }
    }
}
