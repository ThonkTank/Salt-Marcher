package src.domain.dungeon.model.worldspace;

import java.util.Locale;
import src.domain.dungeon.model.core.structure.stair.StairShape;

public enum DungeonStairShape {
    LADDER,
    STRAIGHT,
    SQUARE,
    RECTANGULAR,
    CIRCULAR;

    public static DungeonStairShape defaultShape() {
        return fromCore(StairShape.defaultShape());
    }

    public boolean supportedEditorShape() {
        return core().supportedEditorShape();
    }

    public boolean supportsEditorDimensions(int dimension1, int dimension2) {
        return core().supportsEditorDimensions(dimension1, dimension2);
    }

    public int defaultEditorDimension1() {
        return core().defaultEditorDimension1();
    }

    public int defaultEditorDimension2() {
        return core().defaultEditorDimension2();
    }

    public static DungeonStairShape parse(String value) {
        if (value == null || value.isBlank()) {
            return defaultShape();
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return defaultShape();
        }
    }

    private StairShape core() {
        return StairShape.parse(name());
    }

    private static DungeonStairShape fromCore(StairShape shape) {
        return valueOf(shape.name());
    }
}
