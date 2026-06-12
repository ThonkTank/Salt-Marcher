package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellLoopRasterizer;
import src.domain.dungeon.model.core.geometry.CellLoopSequence;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.Route;

final class DungeonGeometryInvariantHarness {

    private static final String OWNER = "DungeonGeometryInvariantHarness";

    private DungeonGeometryInvariantHarness() {
    }

    static void run(List<String> results) {
        assertDirectionNeighborInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-GEO-001",
                "Direction neighbor deltas preserve cell level and cardinal offsets");
        assertEdgeSideTouchInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-GEO-002",
                "Edge sideOf/touchingCells returns the two authored cells adjacent to each cardinal side");
        assertCellOrderingInvariant();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-GEO-003",
                "CellOrdering deduplicates cells and orders by level, row, then column");
        assertRouteInvariant();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-GEO-004",
                "Route creates horizontal-first corridor cells with explicit level-transition policy");
        assertCellLoopRasterBounds();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-GEO-005",
                "Cell loop rasterization rejects malformed persisted legacy extents, over-cap unit loops, "
                        + "duplicate unit-loop work, many non-unit loops, and overflowing unit loops");
    }

    private static void assertDirectionNeighborInvariants() {
        Cell origin = new Cell(5, 7, 2);
        assertCell(new Cell(5, 6, 2), Direction.NORTH.neighborOf(origin), "north neighbor");
        assertCell(new Cell(6, 7, 2), Direction.EAST.neighborOf(origin), "east neighbor");
        assertCell(new Cell(5, 8, 2), Direction.SOUTH.neighborOf(origin), "south neighbor");
        assertCell(new Cell(4, 7, 2), Direction.WEST.neighborOf(origin), "west neighbor");
    }

    private static void assertEdgeSideTouchInvariants() {
        Cell cell = new Cell(2, 3, 1);
        assertCells(
                List.of(new Cell(2, 2, 1), new Cell(2, 3, 1)),
                Edge.sideOf(cell, Direction.NORTH).touchingCells(),
                "north side touching cells");
        assertCells(
                List.of(new Cell(2, 3, 1), new Cell(3, 3, 1)),
                Edge.sideOf(cell, Direction.EAST).touchingCells(),
                "east side touching cells");
        assertCells(
                List.of(new Cell(2, 3, 1), new Cell(2, 4, 1)),
                Edge.sideOf(cell, Direction.SOUTH).touchingCells(),
                "south side touching cells");
        assertCells(
                List.of(new Cell(1, 3, 1), new Cell(2, 3, 1)),
                Edge.sideOf(cell, Direction.WEST).touchingCells(),
                "west side touching cells");
        assertCells(List.of(), new Edge(new Cell(1, 1, 0), new Cell(2, 2, 0)).touchingCells(), "diagonal edge");
    }

    private static void assertCellOrderingInvariant() {
        List<Cell> sorted = CellOrdering.sortedCells(List.of(
                new Cell(3, 2, 0),
                new Cell(1, 1, 0),
                new Cell(1, 1, 0),
                new Cell(2, 0, 1),
                new Cell(0, 0, -1)));
        assertCells(
                List.of(new Cell(0, 0, -1), new Cell(1, 1, 0), new Cell(3, 2, 0), new Cell(2, 0, 1)),
                sorted,
                "sorted unique cells");
    }

    private static void assertRouteInvariant() {
        assertCells(
                List.of(
                        new Cell(1, 1, 0),
                        new Cell(2, 1, 0),
                        new Cell(3, 1, 0),
                        new Cell(3, 2, 0),
                        new Cell(3, 3, 0)),
                Route.horizontalFirst(new Cell(1, 1, 0), new Cell(3, 3, 0)),
                "horizontal-first route");
        assertCells(
                List.of(new Cell(1, 1, 0), new Cell(2, 1, 0), new Cell(2, 1, 1)),
                Route.horizontalFirst(new Cell(1, 1, 0), new Cell(2, 1, 1)),
                "route preserves explicit level transition");
        assertCells(
                List.of(new Cell(1, 1, 0), new Cell(2, 1, 0)),
                Route.horizontalFirstOnStartLevel(new Cell(1, 1, 0), new Cell(2, 1, 1)),
                "route can stay on start level for authored corridor validation");
    }

    private static void assertCellLoopRasterBounds() {
        assertOversizedLegacyLoopRejected();
        assertManyNonUnitLegacyLoopsRejected();
        assertOverCapUnitLegacyLoopsRejected();
        assertDuplicateUnitLoopWorkRejected();
        assertOverflowingUnitLegacyLoopRejected();
    }

    private static void assertOversizedLegacyLoopRejected() {
        try {
            CellLoopRasterizer.cellsFromRelativeVertices(
                    new Cell(0, 0, 0),
                    0,
                    CellLoopSequence.splitBySeparator(List.of(
                            new Cell(0, 0, 0),
                            new Cell(200_000, 0, 0),
                            new Cell(200_000, 2, 0),
                            new Cell(0, 2, 0))));
        } catch (IllegalArgumentException expected) {
            return;
        }
        throw new IllegalStateException("oversized legacy loop should be rejected");
    }

    private static void assertManyNonUnitLegacyLoopsRejected() {
        List<CellLoopRasterizer.CellLoop> loops = new ArrayList<>();
        for (int index = 0; index < 1_500; index++) {
            loops.add(nonUnitLoop(index % 32, (index / 32) % 32));
        }
        try {
            CellLoopRasterizer.cellsFromRelativeVertices(new Cell(0, 0, 0), 0, loops);
        } catch (IllegalArgumentException expected) {
            return;
        }
        throw new IllegalStateException("many non-unit legacy loops should be rejected");
    }

    private static void assertOverCapUnitLegacyLoopsRejected() {
        List<CellLoopRasterizer.CellLoop> loops = new ArrayList<>();
        for (int q = 0; q <= 100_000; q++) {
            loops.add(unitLoop(q, 0));
        }
        try {
            CellLoopRasterizer.cellsFromRelativeVertices(new Cell(0, 0, 0), 0, loops);
        } catch (IllegalArgumentException expected) {
            return;
        }
        throw new IllegalStateException("over-cap unit legacy loops should be rejected");
    }

    private static void assertDuplicateUnitLoopWorkRejected() {
        List<CellLoopRasterizer.CellLoop> loops = new ArrayList<>();
        for (int index = 0; index <= 100_001; index++) {
            loops.add(unitLoop(0, 0));
        }
        try {
            CellLoopRasterizer.cellsFromRelativeVertices(new Cell(0, 0, 0), 0, loops);
        } catch (IllegalArgumentException expected) {
            return;
        }
        throw new IllegalStateException("duplicate unit legacy loops should be rejected");
    }

    private static void assertOverflowingUnitLegacyLoopRejected() {
        try {
            CellLoopRasterizer.cellsFromRelativeVertices(
                    new Cell(Integer.MAX_VALUE, 0, 0),
                    0,
                    CellLoopSequence.splitBySeparator(List.of(
                            new Cell(1, 0, 0),
                            new Cell(2, 0, 0),
                            new Cell(2, 1, 0),
                            new Cell(1, 1, 0))));
        } catch (ArithmeticException expected) {
            return;
        }
        throw new IllegalStateException("overflowing unit legacy loop should be rejected");
    }

    private static CellLoopRasterizer.CellLoop unitLoop(int q, int r) {
        return new CellLoopRasterizer.CellLoop(List.of(
                new Cell(q, r, 0),
                new Cell(q + 1, r, 0),
                new Cell(q + 1, r + 1, 0),
                new Cell(q, r + 1, 0)));
    }

    private static CellLoopRasterizer.CellLoop nonUnitLoop(int q, int r) {
        return new CellLoopRasterizer.CellLoop(List.of(
                new Cell(q, r, 0),
                new Cell(q + 1, r, 0),
                new Cell(q, r + 1, 0)));
    }

    private static void assertCell(Cell expected, Cell actual, String label) {
        if (!expected.equals(actual)) {
            throw new IllegalStateException(label + " expected " + expected + " but was " + actual);
        }
    }

    private static void assertCells(List<Cell> expected, List<Cell> actual, String label) {
        if (!expected.equals(actual)) {
            throw new IllegalStateException(label + " expected " + expected + " but was " + actual);
        }
    }
}
