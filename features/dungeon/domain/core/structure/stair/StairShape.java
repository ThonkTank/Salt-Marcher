package features.dungeon.domain.core.structure.stair;

import java.util.Locale;

public enum StairShape {
    LADDER,
    STRAIGHT,
    SQUARE,
    RECTANGULAR,
    CIRCULAR;

    public static StairShape defaultShape() {
        return LADDER;
    }

    public static StairShape parse(String value) {
        if (value == null || value.isBlank()) {
            return defaultShape();
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return defaultShape();
        }
    }

    public static StairShape supportedEditorShape(String value) {
        StairShape shape = parse(value);
        return shape.supportedEditorShape() ? shape : null;
    }

    public boolean supportedEditorShape() {
        return switch (this) {
            case STRAIGHT, SQUARE, CIRCULAR -> true;
            default -> false;
        };
    }

    public boolean supportsEditorDimensions(int dimension1, int dimension2) {
        return supportedEditorDimension1(dimension1) && dimension2 >= 1 && dimension2 <= 12;
    }

    public int defaultEditorDimension1() {
        return 3;
    }

    public int normalizedEditorDimension1(int dimension1) {
        if (this == CIRCULAR && dimension1 % 2 == 0) {
            return dimension1 + 1;
        }
        return dimension1;
    }

    public int firstEditorDimension1() {
        return switch (this) {
            case STRAIGHT -> 1;
            case SQUARE -> 2;
            case CIRCULAR -> 3;
            default -> 0;
        };
    }

    public int lastEditorDimension1() {
        return switch (this) {
            case STRAIGHT -> 64;
            case SQUARE -> 16;
            case CIRCULAR -> 31;
            default -> -1;
        };
    }

    public int nextEditorDimension1(int dimension1) {
        return this == CIRCULAR ? dimension1 + 2 : dimension1 + 1;
    }

    private boolean supportedEditorDimension1(int dimension1) {
        return switch (this) {
            case STRAIGHT -> dimension1 >= 1 && dimension1 <= 64;
            case SQUARE -> dimension1 >= 2 && dimension1 <= 16;
            case CIRCULAR -> dimension1 >= 3 && dimension1 <= 31;
            default -> false;
        };
    }
}
