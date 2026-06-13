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
        CellLoopRasterGuard.requireUnitRasterWorkLimit(safeLoops, UNIT_RECTANGLE_VERTEX_COUNT);
        RasterizedCells unitLoopCells = new UnitRectangleLoopRasterizer(center, level).cellsFrom(safeLoops);
        if (unitLoopCells.matched()) {
            return unitLoopCells.cells().isEmpty()
                    ? Set.of(new Cell(center.q(), center.r(), level))
                    : Set.copyOf(unitLoopCells.cells());
        }
        Bounds bounds = bounds(safeLoops);
        CellLoopRasterGuard.requireRasterLimit(bounds.minQ(), bounds.maxQ(), bounds.minR(), bounds.maxR());
        CellLoopRasterGuard.requireGeneralRasterWorkLimit(
                CellLoopRasterGuard.cellCount(bounds.minQ(), bounds.maxQ(), bounds.minR(), bounds.maxR()),
                safeLoops);
        Set<Cell> cells = new LinkedHashSet<>();
        for (long q = bounds.minQ(); q <= bounds.maxQ(); q++) {
            for (long r = bounds.minR(); r <= bounds.maxR(); r++) {
                if (containsCell(safeLoops, Math.toIntExact(q), Math.toIntExact(r))) {
                    cells.add(CellLoopRasterGuard.absoluteCell(center, q, r, level));
                }
            }
        }
        return cells.isEmpty() ? Set.of(new Cell(center.q(), center.r(), level)) : Set.copyOf(cells);
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
            CellLoopRasterGuard.requireUnitRasterWorkLimit(loops, UNIT_RECTANGLE_VERTEX_COUNT);
            Set<Cell> cells = new LinkedHashSet<>();
            for (CellLoop loop : loops) {
                Cell cell = cellFrom(loop.vertices());
                if (cell == null) {
                    return new RasterizedCells(false, Set.of());
                }
                if (cells.contains(cell)) {
                    cells.remove(cell);
                } else {
                    CellLoopRasterGuard.requireRasterizedCellLimit(cells.size() + 1L);
                    cells.add(cell);
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
            return CellLoopRasterGuard.absoluteCell(center, bounds.minQ(), bounds.minR(), level);
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
