package features.dungeon.domain.core.structure.room;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;

public enum BoundaryStretchOrientation {
    HORIZONTAL,
    VERTICAL;

    public static @Nullable BoundaryStretchOrientation from(@Nullable DungeonBoundaryKey key) {
        if (key == null) {
            return null;
        }
        return key.lower().q() == key.upper().q() ? VERTICAL : HORIZONTAL;
    }

    static @Nullable BoundaryStretchOrientation from(@Nullable Edge edge) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        if (edge.from().q() == edge.to().q()) {
            return VERTICAL;
        }
        if (edge.from().r() == edge.to().r()) {
            return HORIZONTAL;
        }
        return null;
    }

    public boolean perpendicularTo(@Nullable BoundaryStretchOrientation other) {
        return other != null && this != other;
    }

    boolean vertical() {
        return this == VERTICAL;
    }

    int fixedCoordinate(Edge edge) {
        return vertical() ? edge.from().q() : edge.from().r();
    }

    int variableCoordinate(Edge edge) {
        return vertical()
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    int movementAlongNormal(int deltaQ, int deltaR) {
        if (vertical()) {
            return deltaR == 0 ? deltaQ : 0;
        }
        return deltaQ == 0 ? deltaR : 0;
    }

    public Edge move(Edge edge, int movement) {
        if (vertical()) {
            return new Edge(
                    new Cell(edge.from().q() + movement, edge.from().r(), edge.from().level()),
                    new Cell(edge.to().q() + movement, edge.to().r(), edge.to().level()));
        }
        return new Edge(
                new Cell(edge.from().q(), edge.from().r() + movement, edge.from().level()),
                new Cell(edge.to().q(), edge.to().r() + movement, edge.to().level()));
    }
}
