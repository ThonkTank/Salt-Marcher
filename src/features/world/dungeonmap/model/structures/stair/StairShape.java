package features.world.dungeonmap.model.structures.stair;

import java.util.Optional;

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

    public Optional<String> validateDimensions(int dimension1, int dimension2) {
        if (needsSideLength() && dimension1 <= 0) {
            return Optional.of("Seitenlänge muss größer als 0 sein");
        }
        if (needsDimensions() && (dimension1 <= 0 || dimension2 <= 0)) {
            return Optional.of("Breite und Tiefe müssen größer als 0 sein");
        }
        if (needsRadius() && dimension1 <= 0) {
            return Optional.of("Radius muss größer als 0 sein");
        }
        return Optional.empty();
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
