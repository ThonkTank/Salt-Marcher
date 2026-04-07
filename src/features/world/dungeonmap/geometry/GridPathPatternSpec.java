package features.world.dungeonmap.geometry;

import java.util.Objects;
import java.util.Optional;

public record GridPathPatternSpec(
        GridPathPatternKind kind,
        CardinalDirection direction,
        int parameter1,
        int parameter2
) {

    public GridPathPatternSpec {
        kind = kind == null ? GridPathPatternKind.STACK : kind;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
    }

    public static GridPathPatternSpec defaultSpec() {
        return new GridPathPatternSpec(GridPathPatternKind.STACK, CardinalDirection.defaultDirection(), 0, 0);
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

    public GridPathPatternSpec withKind(GridPathPatternKind nextKind) {
        return new GridPathPatternSpec(
                Objects.requireNonNullElse(nextKind, GridPathPatternKind.STACK),
                direction,
                parameter1,
                parameter2);
    }
}
