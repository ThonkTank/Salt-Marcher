package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceGeometry;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Area;
import features.dungeon.domain.core.geometry.Cell;

public final class PreviewDungeonEditorSurfaceAreaMoveHelper {

    public List<Area> movedClusterAreas(List<Area> areas, long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        List<Area> result = new ArrayList<>();
        for (Area area : areas) {
            result.add(area.clusterId() == clusterId ? movedArea(area, deltaQ, deltaR, deltaLevel) : area);
        }
        return List.copyOf(result);
    }

    public List<Area> movedAffectedAreaCells(
            List<Area> areas,
            long clusterId,
            Set<Cell> affectedCells,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (clusterId <= 0L || affectedCells.isEmpty()) {
            return areas;
        }
        List<Area> result = new ArrayList<>();
        for (Area area : areas) {
            result.add(area.clusterId() == clusterId
                    ? movedAffectedAreaCells(area, affectedCells, deltaQ, deltaR, deltaLevel)
                    : area);
        }
        return List.copyOf(result);
    }

    public Set<Cell> clusterCells(List<Area> areas, long clusterId) {
        Set<Cell> result = new HashSet<>();
        for (Area area : areas) {
            if (area.clusterId() != clusterId) {
                continue;
            }
            result.addAll(area.cells());
        }
        return Set.copyOf(result);
    }

    private Area movedArea(Area area, int deltaQ, int deltaR, int deltaLevel) {
        List<Cell> cells = new ArrayList<>();
        for (Cell cell : area.cells()) {
            cells.add(DungeonEditorWorkspaceGeometry.movedCell(cell, deltaQ, deltaR, deltaLevel));
        }
        return new Area(area.kind(), area.id(), area.clusterId(), area.label(), cells, area.topologyRef());
    }

    private Area movedAffectedAreaCells(
            Area area,
            Set<Cell> affectedCells,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Cell> cells = new ArrayList<>();
        Set<Cell> sourceCells = new HashSet<>(area.cells());
        Set<Cell> emitted = new HashSet<>();
        for (Cell cell : area.cells()) {
            if (!affectedCells.contains(cell)) {
                appendCell(cells, emitted, cell);
                continue;
            }
            Cell moved = DungeonEditorWorkspaceGeometry.movedCell(cell, deltaQ, deltaR, deltaLevel);
            if (sourceCells.contains(moved)) {
                continue;
            }
            appendCell(cells, emitted, cell);
            appendCell(cells, emitted, moved);
        }
        return new Area(area.kind(), area.id(), area.clusterId(), area.label(), cells, area.topologyRef());
    }

    private static void appendCell(List<Cell> cells, Set<Cell> emitted, Cell cell) {
        if (emitted.add(cell)) {
            cells.add(cell);
        }
    }

}
