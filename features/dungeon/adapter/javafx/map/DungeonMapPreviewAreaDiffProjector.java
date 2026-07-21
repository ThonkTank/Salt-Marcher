package features.dungeon.adapter.javafx.map;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.editor.DungeonEditorSelection;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.CellKind;

final class DungeonMapPreviewAreaDiffProjector {

    void addPreviewAreaDiff(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            List<PreviewAreaDiffFrame> areas,
            DungeonEditorSelection selection,
            DungeonMapRoomLabelPlanner roomLabelPlanner
    ) {
        for (PreviewAreaDiffFrame area : areas) {
            addPreviewArea(cells, labels, area, selection, roomLabelPlanner);
        }
    }

    private void addPreviewArea(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            PreviewAreaDiffFrame area,
            DungeonEditorSelection selection,
            DungeonMapRoomLabelPlanner roomLabelPlanner
    ) {
        boolean selected = selectedArea(area, selection);
        boolean surfaceSelected = selectedAreaSurface(area, selection);
        List<DungeonMapRenderState.Cell> previewCells = new ArrayList<>();
        for (DungeonCellRef cell : area.cells()) {
            previewCells.add(new DungeonMapRenderState.Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    area.label(),
                    areaKind(area),
                    area.id(),
                    area.clusterId(),
                    DungeonMapRenderElementFactory.topologyRef(area.topologyRef()),
                    surfaceSelected,
                    false,
                    true,
                    area.destructive()));
        }
        cells.addAll(previewCells);
        if (previewCells.isEmpty()) {
            return;
        }
        labels.add(DungeonMapRenderElementFactory.roomLabel(
                area.label(),
                area.id(),
                area.clusterId(),
                DungeonMapRenderElementFactory.topologyRef(area.topologyRef()),
                previewCells,
                roomLabelPlanner,
                selected,
                true));
    }

    private static DungeonMapRenderState.CellKind areaKind(PreviewAreaDiffFrame area) {
        return "CORRIDOR".equalsIgnoreCase(area.kind())
                ? CellKind.CORRIDOR
                : CellKind.ROOM;
    }

    private static boolean selectedArea(
            PreviewAreaDiffFrame area,
            DungeonEditorSelection selection
    ) {
        if (selection == null) {
            return false;
        }
        if (selection.clusterSelection()) {
            return areaKind(area) == CellKind.ROOM && area.clusterId() == selection.clusterId();
        }
        return DungeonMapRenderElementFactory.topologyRef(area.topologyRef())
                .equals(DungeonMapRenderElementFactory.topologyRef(selection.topologyRef()));
    }

    private static boolean selectedAreaSurface(
            PreviewAreaDiffFrame area,
            DungeonEditorSelection selection
    ) {
        return selection != null
                && !selection.clusterSelection()
                && DungeonMapRenderElementFactory.topologyRef(area.topologyRef())
                .equals(DungeonMapRenderElementFactory.topologyRef(selection.topologyRef()));
    }
}
