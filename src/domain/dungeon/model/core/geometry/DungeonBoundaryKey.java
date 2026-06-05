package src.domain.dungeon.model.core.geometry;

public record DungeonBoundaryKey(
        Cell lower,
        Cell upper
) {

    public static DungeonBoundaryKey from(Edge edge) {
        Cell from = edge.from();
        Cell to = edge.to();
        int comparison = compareCells(from, to);
        return comparison <= 0 ? new DungeonBoundaryKey(from, to) : new DungeonBoundaryKey(to, from);
    }

    public long stableId() {
        return new EdgeKey(lower, upper).stableId();
    }

    private static int compareCells(Cell left, Cell right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
        return CellOrdering.compareCells(left, right);
    }
}
