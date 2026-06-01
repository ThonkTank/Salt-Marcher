package src.domain.dungeon.model.worldspace.model;


import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class DungeonRoomCellRasterizer {

    private static final int UNIT_RECTANGLE_VERTEX_COUNT = 4;

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
        RasterizedCells unitLoopCells = new UnitRectangleLoopRasterizer(center, level).cellsFrom(loops);
        if (unitLoopCells.matched()) {
            return unitLoopCells.cells().isEmpty()
                    ? Set.of(new DungeonCell(center.q(), center.r(), level))
                    : Set.copyOf(unitLoopCells.cells());
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
        List<DungeonCell> rectangularLoop = rectangularLoop(center, cells);
        if (!rectangularLoop.isEmpty()) {
            return rectangularLoop;
        }
        List<DungeonCell> vertices = new ArrayList<>();
        for (DungeonCell cell : DungeonCellOrdering.sortedCells(cells)) {
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

    private static List<DungeonCell> rectangularLoop(DungeonCell center, List<DungeonCell> cells) {
        Bounds bounds = cellBounds(cells);
        if (!sameLevel(cells) || !filledRectangle(cells, bounds)) {
            return List.of();
        }
        int level = cells.getFirst().level();
        return List.of(
                new DungeonCell(bounds.minQ() - center.q(), bounds.minR() - center.r(), level),
                new DungeonCell(bounds.maxQ() + 1 - center.q(), bounds.minR() - center.r(), level),
                new DungeonCell(bounds.maxQ() + 1 - center.q(), bounds.maxR() + 1 - center.r(), level),
                new DungeonCell(bounds.minQ() - center.q(), bounds.maxR() + 1 - center.r(), level));
    }

    private static Bounds cellBounds(List<DungeonCell> cells) {
        int minQ = cells.getFirst().q();
        int maxQ = minQ;
        int minR = cells.getFirst().r();
        int maxR = minR;
        for (DungeonCell cell : cells) {
            minQ = Math.min(minQ, cell.q());
            maxQ = Math.max(maxQ, cell.q());
            minR = Math.min(minR, cell.r());
            maxR = Math.max(maxR, cell.r());
        }
        return new Bounds(minQ, maxQ, minR, maxR);
    }

    private static boolean sameLevel(List<DungeonCell> cells) {
        int level = cells.getFirst().level();
        for (DungeonCell cell : cells) {
            if (cell.level() != level) {
                return false;
            }
        }
        return true;
    }

    private static boolean filledRectangle(List<DungeonCell> cells, Bounds bounds) {
        Set<DungeonCell> cellSet = new LinkedHashSet<>(cells);
        int expectedSize = (bounds.maxQ() - bounds.minQ() + 1) * (bounds.maxR() - bounds.minR() + 1);
        if (cellSet.size() != expectedSize) {
            return false;
        }
        int level = cells.getFirst().level();
        for (int q = bounds.minQ(); q <= bounds.maxQ(); q++) {
            for (int r = bounds.minR(); r <= bounds.maxR(); r++) {
                if (!cellSet.contains(new DungeonCell(q, r, level))) {
                    return false;
                }
            }
        }
        return true;
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

    private record RasterizedCells(boolean matched, Set<DungeonCell> cells) {
    }

    private record UnitRectangleLoopRasterizer(DungeonCell center, int level) {

        private RasterizedCells cellsFrom(List<List<DungeonCell>> loops) {
            Set<DungeonCell> cells = new LinkedHashSet<>();
            for (List<DungeonCell> loop : loops) {
                DungeonCell cell = cellFrom(loop);
                if (cell == null) {
                    return new RasterizedCells(false, Set.of());
                }
                if (!cells.add(cell)) {
                    cells.remove(cell);
                }
            }
            return new RasterizedCells(true, cells);
        }

        private DungeonCell cellFrom(List<DungeonCell> loop) {
            if (loop.size() != UNIT_RECTANGLE_VERTEX_COUNT) {
                return null;
            }
            Bounds bounds = unitLoopBounds(loop);
            if (bounds.maxQ() - bounds.minQ() != 1 || bounds.maxR() - bounds.minR() != 1) {
                return null;
            }
            if (!containsCorner(loop, bounds.minQ(), bounds.minR())
                    || !containsCorner(loop, bounds.maxQ(), bounds.minR())
                    || !containsCorner(loop, bounds.maxQ(), bounds.maxR())
                    || !containsCorner(loop, bounds.minQ(), bounds.maxR())) {
                return null;
            }
            return new DungeonCell(center.q() + bounds.minQ(), center.r() + bounds.minR(), level);
        }

        private Bounds unitLoopBounds(List<DungeonCell> loop) {
            int minQ = loop.getFirst().q();
            int maxQ = minQ;
            int minR = loop.getFirst().r();
            int maxR = minR;
            for (DungeonCell vertex : loop) {
                minQ = Math.min(minQ, vertex.q());
                maxQ = Math.max(maxQ, vertex.q());
                minR = Math.min(minR, vertex.r());
                maxR = Math.max(maxR, vertex.r());
            }
            return new Bounds(minQ, maxQ, minR, maxR);
        }

        private boolean containsCorner(List<DungeonCell> loop, int q, int r) {
            for (DungeonCell vertex : loop) {
                if (vertex.q() == q && vertex.r() == r) {
                    return true;
                }
            }
            return false;
        }
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
