package src.domain.dungeon.model.core.structure.transition;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

public record TransitionAnchor(
        Kind kind,
        @Nullable Cell cell,
        @Nullable Direction edgeDirection
) {
    public TransitionAnchor {
        kind = kind == null ? Kind.NONE : kind;
        switch (kind) {
            case NONE -> {
                if (cell != null || edgeDirection != null) {
                    throw new IllegalArgumentException("NONE transition anchor cannot carry placement fields.");
                }
            }
            case CELL -> {
                if (cell == null || edgeDirection != null) {
                    throw new IllegalArgumentException("CELL transition anchor requires one cell and no edge direction.");
                }
            }
            case EDGE -> {
                if (cell == null || edgeDirection == null) {
                    throw new IllegalArgumentException("EDGE transition anchor requires one cell and one edge direction.");
                }
            }
        }
    }

    public static TransitionAnchor none() {
        return new TransitionAnchor(Kind.NONE, null, null);
    }

    public static TransitionAnchor cell(Cell cell) {
        return new TransitionAnchor(Kind.CELL, cell, null);
    }

    public static TransitionAnchor edge(Cell cell, Direction direction) {
        return new TransitionAnchor(Kind.EDGE, cell, direction);
    }

    public boolean isPlaced() {
        return kind != Kind.NONE;
    }

    public @Nullable Cell displayCell() {
        return cell;
    }

    public @Nullable Cell travelCell() {
        return cell;
    }

    public boolean isEdge() {
        return kind == Kind.EDGE;
    }

    public enum Kind {
        NONE,
        CELL,
        EDGE
    }

}
