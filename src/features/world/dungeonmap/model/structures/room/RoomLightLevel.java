package features.world.dungeonmap.model.structures.room;

public enum RoomLightLevel {
    UNSPECIFIED("Licht: automatisch", ""),
    DARK("Dunkel", "Der Raum liegt fast vollständig im Dunkeln."),
    DIM("Dämmrig", "Schwaches Licht lässt die Konturen nur undeutlich erkennen."),
    LIT("Beleuchtet", "Der Raum ist gut beleuchtet."),
    FLICKERING("Flackernd", "Flackerndes Licht wirft unruhige Schatten.");

    private final String label;
    private final String descriptionSentence;

    RoomLightLevel(String label, String descriptionSentence) {
        this.label = label;
        this.descriptionSentence = descriptionSentence;
    }

    public String label() {
        return label;
    }

    public String descriptionSentence() {
        return descriptionSentence;
    }

    public static RoomLightLevel fromStorage(String value) {
        if (value == null || value.isBlank()) {
            return UNSPECIFIED;
        }
        try {
            return RoomLightLevel.valueOf(value.trim());
        } catch (IllegalArgumentException ignored) {
            return UNSPECIFIED;
        }
    }
}
