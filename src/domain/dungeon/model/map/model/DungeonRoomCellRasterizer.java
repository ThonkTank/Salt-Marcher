package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonCell;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class DungeonRoomCellRasterizer {

    Set<DungeonCell> cellsFromRelativeVertices(
            DungeonCell center,
            int level,
            List<DungeonCell> relativeVertices,
            DungeonCell loopSeparator
    ) {
        List<List<DungeonCell>> loops = splitLoops(relativeVertices, loopSeparator);
        if (loops.isEmpty()) {
            return Set.of(new DungeonCell(center.q(), center.r(), level));
        }
        Bounds bounds = bounds(loops);
        Set<DungeonCell> cells = new LinkedHashSet<>();
        for (int q = bounds.minQ(); q <= bounds.maxQ(); q++) {
            for (int r = bounds.minR(); r <= bounds.maxR(); r++) {
                if (containsCell(loops, q, r)) {
                    cells.add(new DungeonCell(center.q() + q, center.r() + r, level));
                }
            }
        }
        return cells.isEmpty() ? Set.of(new DungeonCell(center.q(), center.r(), level)) : Set.copyOf(cells);
    }

    List<DungeonCell> relativeCellLoops(DungeonCell center, List<DungeonCell> cells, DungeonCell loopSeparator) {
        if (center == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        List<DungeonCell> vertices = new ArrayList<>();
        for (DungeonCell cell : DungeonRoomCellProjection.sortedCells(cells)) {
            int q = cell.q() - center.q();
            int r = cell.r() - center.r();
            vertices.add(new DungeonCell(q, r, cell.level()));
            vertices.add(new DungeonCell(q + 1, r, cell.level()));
            vertices.add(new DungeonCell(q + 1, r + 1, cell.level()));
            vertices.add(new DungeonCell(q, r + 1, cell.level()));
            vertices.add(loopSeparator);
        }
        return List.copyOf(vertices);
    }

    private static List<List<DungeonCell>> splitLoops(List<DungeonCell> vertices, DungeonCell loopSeparator) {
        List<List<DungeonCell>> loops = new ArrayList<>();
        List<DungeonCell> currentLoop = new ArrayList<>();
        for (DungeonCell vertex : vertices == null ? List.<DungeonCell>of() : vertices) {
            if (loopSeparator.equals(vertex)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(List.copyOf(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            currentLoop.add(vertex);
        }
        if (!currentLoop.isEmpty()) {
            loops.add(List.copyOf(currentLoop));
        }
        return List.copyOf(loops);
    }

    private static boolean containsCell(List<List<DungeonCell>> loops, int q, int r) {
        boolean inside = false;
        for (List<DungeonCell> loop : loops) {
            if (polygonContainsCell(loop, q, r)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static Bounds bounds(List<List<DungeonCell>> loops) {
        int minQ = 0;
        int maxQ = 0;
        int minR = 0;
        int maxR = 0;
        boolean found = false;
        for (List<DungeonCell> loop : loops) {
            for (DungeonCell cell : loop) {
                if (cell == null) {
                    continue;
                }
                if (!found) {
                    minQ = cell.q();
                    maxQ = cell.q();
                    minR = cell.r();
                    maxR = cell.r();
                    found = true;
                    continue;
                }
                minQ = Math.min(minQ, cell.q());
                maxQ = Math.max(maxQ, cell.q());
                minR = Math.min(minR, cell.r());
                maxR = Math.max(maxR, cell.r());
            }
        }
        return new Bounds(minQ, maxQ, minR, maxR);
    }

    private record Bounds(int minQ, int maxQ, int minR, int maxR) {
    }

    private static boolean polygonContainsCell(List<DungeonCell> polygon, int q, int r) {
        double px = q + 0.5D;
        double py = r + 0.5D;
        boolean inside = false;
        int previous = polygon.size() - 1;
        for (int current = 0; current < polygon.size(); current++) {
            DungeonCell currentCell = polygon.get(current);
            DungeonCell previousCell = polygon.get(previous);
            boolean intersects = ((currentCell.r() > py) != (previousCell.r() > py))
                    && (px < (double) (previousCell.q() - currentCell.q()) * (py - currentCell.r())
                    / (double) (previousCell.r() - currentCell.r()) + currentCell.q());
            if (intersects) {
                inside = !inside;
            }
            previous = current;
        }
        return inside;
    }
}
