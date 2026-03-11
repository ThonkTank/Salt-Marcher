package features.world.dungeonmap.model;

public enum PassageType {
    DOOR("Tür"),
    OPEN("Offener Durchgang"),
    WINDOW("Fenster"),
    HOLE("Loch"),
    SECRET("Geheimtür");

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

    public static PassageType fromDb(String value) {
        if (value == null) return DOOR;
        return switch (value) {
            case "open" -> OPEN;
            case "window" -> WINDOW;
            case "hole" -> HOLE;
            case "secret" -> SECRET;
            default -> DOOR;
        };
    }

    @Override
    public String toString() {
        return label;
    }
}
