package features.world.dungeonmap.model;

public enum PassageType {
    OPEN("Durchgang");

    private final String label;

    PassageType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public String dbValue() {
        return name().toLowerCase();
    }

    public static PassageType defaultNewEdgeType() {
        return OPEN;
    }

    public static PassageType fromDb(String value) {
        if (value == null) {
            return OPEN;
        }
        return switch (value) {
            case "door", "open", "window", "hole", "secret" -> OPEN;
            default -> throw new IllegalArgumentException("Unknown passage type: " + value);
        };
    }

    @Override
    public String toString() {
        return label;
    }
}
