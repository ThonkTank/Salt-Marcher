package features.catalog.application;

public enum CatalogSectionId {
    MONSTERS("Monster"),
    ITEMS("Items"),
    SAVED_ENCOUNTERS("Encounter"),
    NPCS("NPCs"),
    FACTIONS("Fraktionen"),
    LOCATIONS("Orte"),
    ENCOUNTER_TABLES("Encounter-Tabellen");

    private final String label;

    CatalogSectionId(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
