package features.world.dungeonmap.model.structures.room;

public enum RoomAtmosphere {
    UNSPECIFIED("Atmosphäre: automatisch", ""),
    DRY("Trocken", "Die Luft wirkt trocken und abgestanden."),
    MUSTY("Modrig", "Ein modriger Geruch hängt in der Luft."),
    COLD("Kalt", "Eine spürbare Kälte liegt über dem Raum."),
    STUFFY("Stickig", "Die Luft ist stickig und schwer."),
    ECHOING("Hallend", "Schon kleine Geräusche hallen deutlich nach."),
    SILENT("Still", "Eine unnatürliche Stille liegt über dem Raum.");

    private final String label;
    private final String descriptionSentence;

    RoomAtmosphere(String label, String descriptionSentence) {
        this.label = label;
        this.descriptionSentence = descriptionSentence;
    }

    public String label() {
        return label;
    }

    public String descriptionSentence() {
        return descriptionSentence;
    }

    public static RoomAtmosphere fromStorage(String value) {
        if (value == null || value.isBlank()) {
            return UNSPECIFIED;
        }
        try {
            return RoomAtmosphere.valueOf(value.trim());
        } catch (IllegalArgumentException ignored) {
            return UNSPECIFIED;
        }
    }
}
