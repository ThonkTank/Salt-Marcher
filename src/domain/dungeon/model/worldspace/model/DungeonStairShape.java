package src.domain.dungeon.model.worldspace.model;

import java.util.Locale;

public enum DungeonStairShape {
    LADDER,
    STRAIGHT,
    SQUARE,
    RECTANGULAR,
    CIRCULAR;

    public static DungeonStairShape defaultShape() {
        return LADDER;
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
}
