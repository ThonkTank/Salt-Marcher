package features.dungeon.domain.core.geometry;

import java.util.ArrayList;
import java.util.List;

public final class Route {

    private Route() {
    }

    public static List<Cell> horizontalFirst(Cell start, Cell end) {
        return horizontalFirst(start, end, false);
    }

    public static List<Cell> horizontalFirstOnStartLevel(Cell start, Cell end) {
        return horizontalFirst(start, end, true);
    }

    public static List<Cell> verticalFirst(Cell start, Cell end) {
        return verticalFirst(start, end, false);
    }

    public static List<Cell> verticalFirstOnStartLevel(Cell start, Cell end) {
        return verticalFirst(start, end, true);
    }

    private static List<Cell> horizontalFirst(Cell start, Cell end, boolean keepStartLevel) {
        if (start == null || end == null) {
            return List.of();
        }
        List<Cell> result = new ArrayList<>();
        int q = start.q();
        int r = start.r();
        int level = start.level();
        result.add(new Cell(q, r, level));
        while (q != end.q()) {
            q += Integer.compare(end.q(), q);
            result.add(new Cell(q, r, level));
        }
        while (r != end.r()) {
            r += Integer.compare(end.r(), r);
            result.add(new Cell(q, r, level));
        }
        if (!keepStartLevel && level != end.level()) {
            result.add(new Cell(end.q(), end.r(), end.level()));
        }
        return List.copyOf(result);
    }

    private static List<Cell> verticalFirst(Cell start, Cell end, boolean keepStartLevel) {
        if (start == null || end == null) {
            return List.of();
        }
        List<Cell> result = new ArrayList<>();
        int q = start.q();
        int r = start.r();
        int level = start.level();
        result.add(new Cell(q, r, level));
        while (r != end.r()) {
            r += Integer.compare(end.r(), r);
            result.add(new Cell(q, r, level));
        }
        while (q != end.q()) {
            q += Integer.compare(end.q(), q);
            result.add(new Cell(q, r, level));
        }
        if (!keepStartLevel && level != end.level()) {
            result.add(new Cell(end.q(), end.r(), end.level()));
        }
        return List.copyOf(result);
    }
}
