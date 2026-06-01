package src.domain.dungeon.model.core.model.geometry;

public enum Direction {
    NORTH(0, -1, 0, 0, 1, 0),
    EAST(1, 0, 1, 0, 1, 1),
    SOUTH(0, 1, 0, 1, 1, 1),
    WEST(-1, 0, 0, 0, 0, 1);

    private final int deltaQ;
    private final int deltaR;
    private final int edgeFromDeltaQ;
    private final int edgeFromDeltaR;
    private final int edgeToDeltaQ;
    private final int edgeToDeltaR;

    Direction(
            int deltaQ,
            int deltaR,
            int edgeFromDeltaQ,
            int edgeFromDeltaR,
            int edgeToDeltaQ,
            int edgeToDeltaR) {
        this.deltaQ = deltaQ;
        this.deltaR = deltaR;
        this.edgeFromDeltaQ = edgeFromDeltaQ;
        this.edgeFromDeltaR = edgeFromDeltaR;
        this.edgeToDeltaQ = edgeToDeltaQ;
        this.edgeToDeltaR = edgeToDeltaR;
    }

    public Cell neighborOf(Cell cell) {
        return cell.translate(deltaQ, deltaR);
    }

    Edge sideOf(Cell cell) {
        return new Edge(
                cell.translate(edgeFromDeltaQ, edgeFromDeltaR),
                cell.translate(edgeToDeltaQ, edgeToDeltaR));
    }

    public int deltaQ() {
        return deltaQ;
    }

    public int deltaR() {
        return deltaR;
    }
}
