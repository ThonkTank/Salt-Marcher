package features.world.dungeonmap.model.structures.stair;

public enum StairShape {
    LADDER("Leiter"),
    STRAIGHT("Gerade Treppe"),
    SQUARE("Quadratische Treppe"),
    RECTANGULAR("Rechteckige Treppe"),
    CIRCULAR("Runde Treppe");

    private final String label;

    StairShape(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean needsDirection() {
        return this != LADDER;
    }

    public boolean needsSideLength() {
        return this == SQUARE;
    }

    public boolean needsDimensions() {
        return this == RECTANGULAR;
    }

    public boolean needsRadius() {
        return this == CIRCULAR;
    }

    public static StairShape parse(String value) {
        if (value == null || value.isBlank()) {
            return LADDER;
        }
        try {
            return StairShape.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return LADDER;
        }
    }
}
