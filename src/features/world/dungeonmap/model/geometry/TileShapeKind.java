package features.world.dungeonmap.model.geometry;

import java.util.Locale;
import java.util.Optional;

public enum TileShapeKind {
    STACK("Gleiche Zelle", false, null, null),
    LINE("Linie", true, null, null),
    SQUARE("Quadrat", true, "Seitenlänge", null),
    RECTANGLE("Rechteck", true, "Breite", "Tiefe"),
    CIRCLE("Kreis", true, "Radius", null);

    private final String label;
    private final boolean needsDirection;
    private final String parameter1Label;
    private final String parameter2Label;

    TileShapeKind(
            String label,
            boolean needsDirection,
            String parameter1Label,
            String parameter2Label
    ) {
        this.label = label;
        this.needsDirection = needsDirection;
        this.parameter1Label = parameter1Label;
        this.parameter2Label = parameter2Label;
    }

    public String label() {
        return label;
    }

    public boolean needsDirection() {
        return needsDirection;
    }

    public boolean needsParameter1() {
        return parameter1Label != null;
    }

    public boolean needsParameter2() {
        return parameter2Label != null;
    }

    public String parameter1Label() {
        return parameter1Label;
    }

    public String parameter2Label() {
        return parameter2Label;
    }

    public Optional<String> validateParameters(int parameter1, int parameter2) {
        if (this == SQUARE && parameter1 <= 0) {
            return Optional.of("Seitenlänge muss größer als 0 sein");
        }
        if (this == RECTANGLE && (parameter1 <= 0 || parameter2 <= 0)) {
            return Optional.of("Breite und Tiefe müssen größer als 0 sein");
        }
        if (this == CIRCLE && parameter1 <= 0) {
            return Optional.of("Radius muss größer als 0 sein");
        }
        return Optional.empty();
    }

    public static TileShapeKind parse(String value) {
        if (value == null || value.isBlank()) {
            return STACK;
        }
        try {
            return TileShapeKind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return STACK;
        }
    }
}
