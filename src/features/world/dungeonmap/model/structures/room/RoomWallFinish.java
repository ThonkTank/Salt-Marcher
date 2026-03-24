package features.world.dungeonmap.model.structures.room;

public enum RoomWallFinish {
    UNSPECIFIED("Wände: automatisch", ""),
    ROUGH_HEWN("Roh behauen", "Die Wände sind roh aus dem Stein gehauen."),
    MASONRY("Gemauert", "Die Wände sind sauber gemauert."),
    DAMP_STONE("Feuchter Stein", "Feuchtigkeit glitzert auf kaltem Stein."),
    WOODEN("Holzverkleidet", "Holzverkleidete Wände dämpfen den Hall."),
    CRUMBLING("Brüchig", "Die Wände wirken rissig und brüchig.");

    private final String label;
    private final String descriptionSentence;

    RoomWallFinish(String label, String descriptionSentence) {
        this.label = label;
        this.descriptionSentence = descriptionSentence;
    }

    public String label() {
        return label;
    }

    public String descriptionSentence() {
        return descriptionSentence;
    }

    public static RoomWallFinish fromStorage(String value) {
        if (value == null || value.isBlank()) {
            return UNSPECIFIED;
        }
        try {
            return RoomWallFinish.valueOf(value.trim());
        } catch (IllegalArgumentException ignored) {
            return UNSPECIFIED;
        }
    }
}
