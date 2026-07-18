package features.catalog.application;

/** Typed user intents for the read-only Encounter Table Catalog section. */
public sealed interface EncounterTableCatalogIntent {

    record ChangeQuery(String query) implements EncounterTableCatalogIntent { }
    record SelectTable(long tableId) implements EncounterTableCatalogIntent { }
    record UseAsEncounterSource(long tableId) implements EncounterTableCatalogIntent { }
}
