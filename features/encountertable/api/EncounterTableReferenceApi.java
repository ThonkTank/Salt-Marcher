package features.encountertable.api;

/** Read-only Encounter Table capability for consumers that validate stable references. */
@FunctionalInterface
public interface EncounterTableReferenceApi {

    EncounterTableCatalogResult catalog();
}
