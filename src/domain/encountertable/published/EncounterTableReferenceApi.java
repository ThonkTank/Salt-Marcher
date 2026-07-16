package src.domain.encountertable.published;

/** Read-only Encounter Table capability for consumers that validate stable references. */
@FunctionalInterface
public interface EncounterTableReferenceApi {

    EncounterTableCatalogResult catalog();
}
