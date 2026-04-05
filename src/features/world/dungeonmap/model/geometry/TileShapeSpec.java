package features.world.dungeonmap.model.geometry;

import java.util.Objects;
import java.util.Optional;

public record TileShapeSpec(
        TileShapeKind kind,
        CardinalDirection direction,
        int parameter1,
        int parameter2
) {

    public TileShapeSpec {
        kind = kind == null ? TileShapeKind.STACK : kind;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
    }

    public static TileShapeSpec defaultSpec() {
        return new TileShapeSpec(TileShapeKind.STACK, CardinalDirection.defaultDirection(), 0, 0);
    }

    public boolean needsDirection() {
        return kind.needsDirection();
    }

    public boolean needsParameter1() {
        return kind.needsParameter1();
    }

    public boolean needsParameter2() {
        return kind.needsParameter2();
    }

    public String parameter1Label() {
        return kind.parameter1Label();
    }

    public String parameter2Label() {
        return kind.parameter2Label();
    }

    public Optional<String> validate() {
        return kind.validateParameters(parameter1, parameter2);
    }

    public TileShapeSpec withKind(TileShapeKind nextKind) {
        return new TileShapeSpec(
                Objects.requireNonNullElse(nextKind, TileShapeKind.STACK),
                direction,
                parameter1,
                parameter2);
    }
}
