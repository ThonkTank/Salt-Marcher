package src.domain.dungeon.model.core.geometry;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class CellLoopRasterizer {

    private static final int UNIT_RECTANGLE_VERTEX_COUNT = 4;

    private CellLoopRasterizer() {
    }

    public static Set<Cell> cellsFromRelativeVertices(
            Cell center,
            int level,
            List<CellLoop> loops
    ) {
        List<CellLoop> safeLoops = nonEmptyLoops(loops);
        if (safeLoops.isEmpty()) {
            return Set.of(new Cell(center.q(), center.r(), level));
        }
        RasterizedCells unitLoopCells = new UnitRectangleLoopRasterizer(center, level).cellsFrom(safeLoops);
        if (unitLoopCells.matched()) {
            return unitLoopCells.cells().isEmpty()
                    ? Set.of(new Cell(center.q(), center.r(), level))
                    : Set.copyOf(unitLoopCells.cells());
        }
        Bounds bounds = bounds(safeLoops);
        Set<Cell> cells = new LinkedHashSet<>();
        for (int q = bounds.minQ(); q <= bounds.maxQ(); q++) {
            for (int r = bounds.minR(); r <= bounds.maxR(); r++) {
                if (containsCell(safeLoops, q, r)) {
                    cells.add(new Cell(center.q() + q, center.r() + r, level));
                }
            }
        }
        return cells.isEmpty() ? Set.of(new Cell(center.q(), center.r(), level)) : Set.copyOf(cells);
    }

    public static List<CellLoop> relativeCellLoops(Cell center, List<Cell> cells) {
        if (center == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        CellLoop rectangularLoop = rectangularLoop(center, cells);
        if (!rectangularLoop.vertices().isEmpty()) {
            return List.of(rectangularLoop);
        }
        List<CellLoop> loops = new ArrayList<>();
        for (Cell cell : CellOrdering.sortedCells(cells)) {
            int q = cell.q() - center.q();
            int r = cell.r() - center.r();
            loops.add(new CellLoop(List.of(
                    new Cell(q, r, cell.level()),
                    new Cell(q + 1, r, cell.level()),
                    new Cell(q + 1, r + 1, cell.level()),
                    new Cell(q, r + 1, cell.level()))));
        }
        return List.copyOf(loops);
    }

    private static CellLoop rectangularLoop(Cell center, List<Cell> cells) {
        Bounds bounds = cellBounds(cells);
        if (!sameLevel(cells) || !filledRectangle(cells, bounds)) {
            return new CellLoop(List.of());
        }
        int level = cells.getFirst().level();
        return new CellLoop(List.of(
                new Cell(bounds.minQ() - center.q(), bounds.minR() - center.r(), level),
                new Cell(bounds.maxQ() + 1 - center.q(), bounds.minR() - center.r(), level),
                new Cell(bounds.maxQ() + 1 - center.q(), bounds.maxR() + 1 - center.r(), level),
                new Cell(bounds.minQ() - center.q(), bounds.maxR() + 1 - center.r(), level)));
    }

    private static Bounds cellBounds(List<Cell> cells) {
        int minQ = cells.getFirst().q();
        int maxQ = minQ;
        int minR = cells.getFirst().r();
        int maxR = minR;
        for (Cell cell : cells) {
            minQ = Math.min(minQ, cell.q());
            maxQ = Math.max(maxQ, cell.q());
            minR = Math.min(minR, cell.r());
            maxR = Math.max(maxR, cell.r());
        }
        return new Bounds(minQ, maxQ, minR, maxR);
    }

    private static boolean sameLevel(List<Cell> cells) {
        int level = cells.getFirst().level();
        for (Cell cell : cells) {
            if (cell.level() != level) {
                return false;
            }
        }
        return true;
    }

    private static boolean filledRectangle(List<Cell> cells, Bounds bounds) {
        Set<Cell> cellSet = new LinkedHashSet<>(cells);
        int expectedSize = (bounds.maxQ() - bounds.minQ() + 1) * (bounds.maxR() - bounds.minR() + 1);
        if (cellSet.size() != expectedSize) {
            return false;
        }
        int level = cells.getFirst().level();
        for (int q = bounds.minQ(); q <= bounds.maxQ(); q++) {
            for (int r = bounds.minR(); r <= bounds.maxR(); r++) {
                if (!cellSet.contains(new Cell(q, r, level))) {
                    return false;
                }
            }
        }
        return true;
    }

    private static List<CellLoop> nonEmptyLoops(List<CellLoop> loops) {
        List<CellLoop> result = new ArrayList<>();
        for (CellLoop loop : loops == null ? List.<CellLoop>of() : loops) {
            if (loop != null && !loop.vertices().isEmpty()) {
                result.add(loop);
            }
        }
        return List.copyOf(result);
    }

    private static boolean containsCell(List<CellLoop> loops, int q, int r) {
        boolean inside = false;
        for (CellLoop loop : loops) {
            if (polygonContainsCell(loop.vertices(), q, r)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static Bounds bounds(List<CellLoop> loops) {
        int minQ = 0;
        int maxQ = 0;
        int minR = 0;
        int maxR = 0;
        boolean found = false;
        for (CellLoop loop : loops) {
            for (Cell cell : loop.vertices()) {
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

    private static boolean polygonContainsCell(List<Cell> polygon, int q, int r) {
        double px = q + 0.5D;
        double py = r + 0.5D;
        boolean inside = false;
        int previous = polygon.size() - 1;
        for (int current = 0; current < polygon.size(); current++) {
            Cell currentCell = polygon.get(current);
            Cell previousCell = polygon.get(previous);
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

    private record Bounds(int minQ, int maxQ, int minR, int maxR) {
    }

    private record RasterizedCells(boolean matched, Set<Cell> cells) {
    }

    private record UnitRectangleLoopRasterizer(Cell center, int level) {

        private RasterizedCells cellsFrom(List<CellLoop> loops) {
            Set<Cell> cells = new LinkedHashSet<>();
            for (CellLoop loop : loops) {
                Cell cell = cellFrom(loop.vertices());
                if (cell == null) {
                    return new RasterizedCells(false, Set.of());
                }
                if (!cells.add(cell)) {
                    cells.remove(cell);
                }
            }
            return new RasterizedCells(true, cells);
        }

        private Cell cellFrom(List<Cell> loop) {
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
            return new Cell(center.q() + bounds.minQ(), center.r() + bounds.minR(), level);
        }

        private Bounds unitLoopBounds(List<Cell> loop) {
            int minQ = loop.getFirst().q();
            int maxQ = minQ;
            int minR = loop.getFirst().r();
            int maxR = minR;
            for (Cell vertex : loop) {
                minQ = Math.min(minQ, vertex.q());
                maxQ = Math.max(maxQ, vertex.q());
                minR = Math.min(minR, vertex.r());
                maxR = Math.max(maxR, vertex.r());
            }
            return new Bounds(minQ, maxQ, minR, maxR);
        }

        private boolean containsCorner(List<Cell> loop, int q, int r) {
            for (Cell vertex : loop) {
                if (vertex.q() == q && vertex.r() == r) {
                    return true;
                }
            }
            return false;
        }
    }

    public record CellLoop(List<Cell> vertices) {

        public CellLoop {
            vertices = safeVertices(vertices);
        }

        @Override
        public List<Cell> vertices() {
            return List.copyOf(vertices);
        }

        private static List<Cell> safeVertices(List<Cell> source) {
            List<Cell> result = new ArrayList<>();
            for (Cell vertex : source == null ? List.<Cell>of() : source) {
                if (vertex != null) {
                    result.add(vertex);
                }
            }
            return List.copyOf(result);
        }
    }
}
