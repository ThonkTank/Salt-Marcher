package src.domain.dungeon.model.core.geometry;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.CellLoopRasterizer.CellLoop;

public final class CellLoopSequence {

    public static final Cell LOOP_SEPARATOR = new Cell(Integer.MIN_VALUE, Integer.MIN_VALUE, 0);

    private CellLoopSequence() {
    }

    public static List<CellLoop> splitBySeparator(List<Cell> vertices) {
        List<CellLoop> loops = new ArrayList<>();
        List<Cell> currentLoop = new ArrayList<>();
        for (Cell vertex : vertices == null ? List.<Cell>of() : vertices) {
            if (LOOP_SEPARATOR.equals(vertex)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(new CellLoop(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            if (vertex != null) {
                currentLoop.add(vertex);
            }
        }
        if (!currentLoop.isEmpty()) {
            loops.add(new CellLoop(currentLoop));
        }
        return List.copyOf(loops);
    }

    public static List<Cell> relativeCellLoopVertices(Cell center, List<Cell> cells) {
        if (center == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        return flattened(CellLoopRasterizer.relativeCellLoops(center, nonNullCells(cells)));
    }

    private static List<Cell> flattened(List<CellLoop> loops) {
        List<Cell> result = new ArrayList<>();
        List<CellLoop> safeLoops = loops == null ? List.of() : loops;
        boolean separateLoops = safeLoops.size() > 1;
        for (CellLoop loop : safeLoops) {
            result.addAll(loop.vertices());
            if (separateLoops) {
                result.add(LOOP_SEPARATOR);
            }
        }
        return List.copyOf(result);
    }

    private static List<Cell> nonNullCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }
}
