package src.domain.dungeon.model.core.geometry;

public record EdgeKey(Cell lower, Cell upper) {

    public EdgeKey {
        if (CellOrdering.compareCells(lower, upper) > 0) {
            Cell originalLower = lower;
            lower = upper;
            upper = originalLower;
        }
    }

    public static EdgeKey from(Edge edge) {
        return new EdgeKey(edge.from(), edge.to());
    }

    public long stableId() {
        long hash = 17L;
        hash = 31L * hash + cellHash(lower);
        hash = 31L * hash + cellHash(upper);
        return Math.max(1L, Math.abs(hash));
    }

    private static long cellHash(Cell cell) {
        if (cell == null) {
            return 0L;
        }
        long hash = 17L;
        hash = 31L * hash + cell.q();
        hash = 31L * hash + cell.r();
        hash = 31L * hash + cell.level();
        return hash;
    }
}
