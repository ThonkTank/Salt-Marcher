package src.view.leftbartabs.catalog;

enum CatalogSection {
    MONSTERS("Monster"),
    ITEMS("Items"),
    ENCOUNTERS("Encounter"),
    NPCS("NPCs"),
    FACTIONS("Fraktionen"),
    LOCATIONS("Orte"),
    ENCOUNTER_TABLES("Encounter-Tabellen");

    private final String label;

    CatalogSection(String label) {
        this.label = label;
    }

    String label() {
        return label;
    }
}
