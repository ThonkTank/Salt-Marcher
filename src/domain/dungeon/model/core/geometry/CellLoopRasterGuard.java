package src.domain.dungeon.model.core.geometry;

import java.util.List;

final class CellLoopRasterGuard {

    private static final long MAX_RASTERIZED_CELLS = 100_000L;
    private static final long MAX_RASTER_VERTICES = 4_096L;
    private static final long MAX_RASTER_WORK_UNITS = 1_000_000L;

    private CellLoopRasterGuard() {
    }

    static Cell absoluteCell(Cell center, long relativeQ, long relativeR, int level) {
        return new Cell(
                Math.addExact(center.q(), Math.toIntExact(relativeQ)),
                Math.addExact(center.r(), Math.toIntExact(relativeR)),
                level);
    }

    static void requireRasterLimit(int minQ, int maxQ, int minR, int maxR) {
        long cells = cellCount(minQ, maxQ, minR, maxR);
        requireRasterizedCellLimit(cells);
    }

    static void requireGeneralRasterWorkLimit(long cells, List<CellLoopRasterizer.CellLoop> loops) {
        long vertices = totalVertices(loops);
        if (vertices > MAX_RASTER_VERTICES) {
            throw new IllegalArgumentException("Relative cell loop has too many vertices: " + vertices);
        }
        long workUnits = Math.multiplyExact(cells, vertices);
        if (workUnits > MAX_RASTER_WORK_UNITS) {
            throw new IllegalArgumentException("Relative cell loop scan is too large: " + workUnits);
        }
    }

    static void requireUnitRasterWorkLimit(List<CellLoopRasterizer.CellLoop> loops, int verticesPerLoop) {
        long loopCount = loops.size();
        if (loopCount > MAX_RASTERIZED_CELLS) {
            throw new IllegalArgumentException("Relative unit cell loop input has too many loops: " + loopCount);
        }
        long vertices = Math.multiplyExact(loopCount, verticesPerLoop);
        if (vertices > MAX_RASTER_WORK_UNITS) {
            throw new IllegalArgumentException("Relative unit cell loop input has too many vertices: " + vertices);
        }
    }

    private static long totalVertices(List<CellLoopRasterizer.CellLoop> loops) {
        long vertices = 0L;
        for (CellLoopRasterizer.CellLoop loop : loops) {
            vertices = Math.addExact(vertices, loop.vertices().size());
        }
        return vertices;
    }

    static void requireRasterizedCellLimit(long cells) {
        if (cells > MAX_RASTERIZED_CELLS) {
            throw new IllegalArgumentException("Relative cell loop spans too many cells: " + cells);
        }
    }

    static long cellCount(int minQ, int maxQ, int minR, int maxR) {
        long width = (long) maxQ - minQ + 1L;
        long height = (long) maxR - minR + 1L;
        return Math.multiplyExact(width, height);
    }
}
