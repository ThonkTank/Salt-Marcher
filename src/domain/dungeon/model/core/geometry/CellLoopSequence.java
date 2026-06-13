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

}
