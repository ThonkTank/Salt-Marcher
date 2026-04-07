package features.world.dungeon.stair.model;

import features.world.dungeon.geometry.CardinalDirection;

import java.util.Objects;
import java.util.Optional;

public record StairPathPatternSpec(
        StairPathPatternKind kind,
        CardinalDirection direction,
        int parameter1,
        int parameter2
) {

    public StairPathPatternSpec {
        kind = kind == null ? StairPathPatternKind.STACK : kind;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
    }

    public static StairPathPatternSpec defaultSpec() {
        return new StairPathPatternSpec(StairPathPatternKind.STACK, CardinalDirection.defaultDirection(), 0, 0);
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

    public StairPathPatternSpec withKind(StairPathPatternKind nextKind) {
        return new StairPathPatternSpec(
                Objects.requireNonNullElse(nextKind, StairPathPatternKind.STACK),
                direction,
                parameter1,
                parameter2);
    }
}
