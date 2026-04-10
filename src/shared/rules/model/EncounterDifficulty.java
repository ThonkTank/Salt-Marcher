package shared.rules.model;

@SuppressWarnings("unused")
public enum EncounterDifficulty {
    EASY("Easy"),
    MEDIUM("Medium"),
    HARD("Hard"),
    DEADLY("Deadly");

    private final String label;

    EncounterDifficulty(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
