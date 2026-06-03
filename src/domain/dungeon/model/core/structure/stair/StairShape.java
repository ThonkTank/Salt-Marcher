package src.domain.dungeon.model.core.structure.stair;

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

    public int defaultEditorDimension2() {
        return 1;
    }

    public int normalizedEditorDimension1(int dimension1) {
        if (this == CIRCULAR && dimension1 % 2 == 0) {
            return dimension1 + 1;
        }
        return dimension1;
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
