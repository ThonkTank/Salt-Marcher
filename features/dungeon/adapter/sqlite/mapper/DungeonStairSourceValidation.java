package features.dungeon.adapter.sqlite.mapper;

import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.domain.core.structure.stair.StairShape;
import java.util.HashSet;
import java.util.Locale;

/** Shared validation for complete stair identity facts, independent of spatial clipping. */
public final class DungeonStairSourceValidation {

    private DungeonStairSourceValidation() {
    }

    public static StairShape validate(DungeonStairRecord source, boolean corridorBindingPresent) {
        long invalidExits = source.exits().stream()
                .filter(exit -> exit.exitId() <= 0L || exit.label() == null || exit.label().isBlank())
                .count();
        return validate(
                source.name(),
                source.shape(),
                source.direction(),
                source.dimension1(),
                source.dimension2(),
                source.pathNodes().size(),
                new HashSet<>(source.pathNodes()).size(),
                source.exits().size(),
                source.exits().stream().map(DungeonStairExitRecord::cellZ).distinct().count(),
                invalidExits,
                corridorBindingPresent);
    }

    public static StairShape validate(
            String name,
            String shapeName,
            int direction,
            int dimension1,
            int dimension2,
            long pathCount,
            long distinctPathCount,
            long exitCount,
            long exitLevelCount,
            long invalidExitCount,
            boolean corridorBindingPresent
    ) {
        if (name == null || name.isBlank()) {
            throw malformed("stair name is missing");
        }
        StairShape shape = supportedShape(shapeName);
        if (direction < 0 || direction > 3 || !shape.supportsEditorDimensions(dimension1, dimension2)) {
            throw malformed("stair scalar geometry is invalid");
        }
        if (pathCount == 0L || exitCount == 0L) {
            throw incomplete("stair path or exits are missing");
        }
        if (pathCount != distinctPathCount) {
            throw malformed("stair path contains duplicate stored nodes");
        }
        if (invalidExitCount != 0L) {
            throw malformed("stair exit identity or label is invalid");
        }
        if (exitLevelCount < 2L) {
            throw incomplete("stair exits do not span two levels");
        }
        if (!corridorBindingPresent) {
            throw incomplete("stair corridor binding is missing");
        }
        return shape;
    }

    private static StairShape supportedShape(String value) {
        StairShape shape;
        try {
            shape = StairShape.valueOf(value == null ? "" : value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw malformed("stair shape is invalid");
        }
        if (!shape.supportedEditorShape()) {
            throw malformed("stair shape is unsupported");
        }
        return shape;
    }

    private static Failure malformed(String message) {
        return new Failure(false, message);
    }

    private static Failure incomplete(String message) {
        return new Failure(true, message);
    }

    public static final class Failure extends IllegalArgumentException {
        private final boolean incomplete;

        private Failure(boolean incomplete, String message) {
            super(message);
            this.incomplete = incomplete;
        }

        public boolean incomplete() {
            return incomplete;
        }
    }
}
