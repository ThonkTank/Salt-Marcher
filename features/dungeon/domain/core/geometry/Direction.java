package features.dungeon.domain.core.geometry;

import java.util.Locale;
import org.jspecify.annotations.Nullable;

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

    public static Direction parse(String value) {
        if (value == null || value.isBlank()) {
            return NORTH;
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "EAST" -> EAST;
            case "SOUTH" -> SOUTH;
            case "WEST" -> WEST;
            default -> NORTH;
        };
    }

    public static @Nullable Direction supportedCardinal(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "NORTH" -> NORTH;
            case "EAST" -> EAST;
            case "SOUTH" -> SOUTH;
            case "WEST" -> WEST;
            default -> null;
        };
    }

    Edge sideOf(Cell cell) {
        return edgeOf(cell);
    }

    public Edge edgeOf(Cell cell) {
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
