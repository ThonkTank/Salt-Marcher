package src.domain.encounter.model.generation.model;

public enum EncounterRole {
    BOSS("Boss"),
    BRUTE("Brute"),
    MINION("Minion"),
    SKIRMISHER("Skirmisher"),
    ELITE("Elite"),
    STANDARD("Standard");

    private final String label;

    EncounterRole(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
