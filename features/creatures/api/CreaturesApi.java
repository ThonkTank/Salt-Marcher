package features.creatures.api;

public interface CreaturesApi {

    void refreshFilterOptions(RefreshCreatureFilterOptionsCommand command);

    void refreshCatalog(RefreshCreatureCatalogCommand command);

    void selectCreatureDetail(SelectCreatureDetailCommand command);

    void refreshEncounterCandidates(RefreshCreatureEncounterCandidatesCommand command);
}
