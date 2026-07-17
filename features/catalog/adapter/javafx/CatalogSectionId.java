package features.catalog.adapter.javafx;

enum CatalogSectionId {
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

    String label() {
        return label;
    }
}
