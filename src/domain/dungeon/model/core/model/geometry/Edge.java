package src.domain.dungeon.model.core.model.geometry;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public record Edge(Cell from, Cell to) {

    public Edge {
        Objects.requireNonNull(from);
        Objects.requireNonNull(to);
    }

    public static Edge sideOf(Cell cell, Direction direction) {
        return Objects.requireNonNull(direction).sideOf(Objects.requireNonNull(cell));
    }

    public List<Cell> touchingCells() {
        if (from.level() != to.level()) {
            return List.of();
        }
        if (from.r() == to.r()) {
            return horizontalTouchingCells();
        }
        if (from.q() == to.q()) {
            return verticalTouchingCells();
        }
        return List.of();
    }

    private List<Cell> horizontalTouchingCells() {
        int minQ = Math.min(from.q(), to.q());
        int maxQ = Math.max(from.q(), to.q());
        List<Cell> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new Cell(q, from.r() - 1, from.level()));
            result.add(new Cell(q, from.r(), from.level()));
        }
        return List.copyOf(result);
    }

    private List<Cell> verticalTouchingCells() {
        int minR = Math.min(from.r(), to.r());
        int maxR = Math.max(from.r(), to.r());
        List<Cell> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new Cell(from.q() - 1, r, from.level()));
            result.add(new Cell(from.q(), r, from.level()));
        }
        return List.copyOf(result);
    }
}
