package features.encountertable.api;

public interface EncounterTableApi {

    void refreshCatalog(RefreshEncounterTableCatalogCommand command);

    void refreshCandidates(RefreshEncounterTableCandidatesCommand command);
}
