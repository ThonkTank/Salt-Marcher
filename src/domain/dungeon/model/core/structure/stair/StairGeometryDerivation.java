package src.domain.dungeon.model.core.structure.stair;

import java.util.List;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

public final class StairGeometryDerivation {
    public Result derive(Cell start, Cell end, StairShape shape) {
        if (start == null || end == null) {
            return Result.rejected(Rejection.MISSING_ENDPOINT);
        }
        StairShape safeShape = shape == null || !shape.supportedEditorShape() ? null : shape;
        if (safeShape == null) {
            return Result.rejected(Rejection.UNSUPPORTED_SHAPE);
        }
        int levelSpan = Math.abs(end.level() - start.level());
        if (levelSpan == 0) {
            return Result.rejected(Rejection.ZERO_LEVEL_SPAN);
        }
        if (!safeShape.supportsEditorDimensions(safeShape.defaultEditorDimension1(), levelSpan)) {
            return Result.rejected(Rejection.DIMENSION_OUT_OF_BOUNDS);
        }
        Cell lower = lowerEndpoint(start, end);
        Cell upper = lower.equals(start) ? end : start;
        return switch (safeShape) {
            case STRAIGHT -> deriveStraight(lower, upper, levelSpan);
            case SQUARE, CIRCULAR -> deriveFootprint(safeShape, lower, upper, levelSpan);
            default -> Result.rejected(Rejection.UNSUPPORTED_SHAPE);
        };
    }

    private static Result deriveStraight(Cell lower, Cell upper, int levelSpan) {
        int deltaQ = upper.q() - lower.q();
        int deltaR = upper.r() - lower.r();
        if (deltaQ == 0 && deltaR == 0) {
            return valid(new StairGeometrySpec(StairShape.STRAIGHT, lower, Direction.NORTH, 1, levelSpan));
        }
        Direction direction = directionFor(deltaQ, deltaR);
        if (direction == null) {
            return Result.rejected(Rejection.ENDPOINT_MISMATCH);
        }
        int dimension1 = Math.abs(deltaQ) + Math.abs(deltaR) + 1;
        StairGeometrySpec spec = new StairGeometrySpec(StairShape.STRAIGHT, lower, direction, dimension1, levelSpan);
        return spec.shape().supportsEditorDimensions(spec.dimension1(), spec.dimension2())
                ? valid(spec)
                : Result.rejected(Rejection.DIMENSION_OUT_OF_BOUNDS);
    }

    private static Result deriveFootprint(StairShape shape, Cell lower, Cell upper, int levelSpan) {
        for (int dimension1 = shape.firstEditorDimension1();
                dimension1 <= shape.lastEditorDimension1();
                dimension1 = shape.nextEditorDimension1(dimension1)) {
            for (Direction direction : Direction.values()) {
                StairGeometrySpec spec = new StairGeometrySpec(shape, lower, direction, dimension1, levelSpan);
                if (exitsMatch(spec, lower, upper)) {
                    return valid(spec);
                }
            }
        }
        return Result.rejected(Rejection.ENDPOINT_MISMATCH);
    }

    private static boolean exitsMatch(StairGeometrySpec spec, Cell lower, Cell upper) {
        List<StairExit> exits = spec.generatedExits(List.of());
        return !exits.isEmpty()
                && lower.equals(exits.getFirst().position())
                && upper.equals(exits.getLast().position());
    }

    private static Result valid(StairGeometrySpec spec) {
        return new Result(spec, Rejection.NONE);
    }

    public static String rejectionStatusDetail(Result result) {
        return result == null ? Rejection.MISSING_ENDPOINT.statusDetail() : result.rejection().statusDetail();
    }

    private static Cell lowerEndpoint(Cell first, Cell second) {
        return first.level() <= second.level() ? first : second;
    }

    private static Direction directionFor(int deltaQ, int deltaR) {
        if (deltaR == 0 && deltaQ > 0) {
            return Direction.EAST;
        }
        if (deltaR == 0 && deltaQ < 0) {
            return Direction.WEST;
        }
        if (deltaQ == 0 && deltaR > 0) {
            return Direction.SOUTH;
        }
        if (deltaQ == 0 && deltaR < 0) {
            return Direction.NORTH;
        }
        return null;
    }

    public record Result(StairGeometrySpec spec, Rejection rejection) {
        public Result {
            rejection = rejection == null ? Rejection.NONE : rejection;
        }

        public static Result rejected(Rejection rejection) {
            return new Result(null, rejection);
        }

        public boolean valid() {
            return spec != null;
        }
    }

    public enum Rejection {
        NONE("Start- oder Zielpunkt fehlt."),
        MISSING_ENDPOINT("Start- oder Zielpunkt fehlt."),
        UNSUPPORTED_SHAPE("Treppenform wird nicht unterstuetzt."),
        ZERO_LEVEL_SPAN("Start und Ziel muessen auf unterschiedlichen Ebenen liegen."),
        DIMENSION_OUT_OF_BOUNDS("Ebenenspanne liegt ausserhalb der erlaubten Treppenwerte."),
        ENDPOINT_MISMATCH("Zielpunkt passt nicht zur gewaehlten Form.");

        private final String statusDetail;

        Rejection(String statusDetail) {
            this.statusDetail = statusDetail;
        }

        public String statusDetail() {
            return statusDetail;
        }
    }
}
