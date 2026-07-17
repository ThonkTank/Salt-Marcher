package features.creatures.api;

public interface CreaturesApi {

    void refreshReferenceIndex(RefreshCreatureReferenceIndexCommand command);

    void selectCreatureDetail(SelectCreatureDetailCommand command);

    void refreshEncounterCandidates(RefreshCreatureEncounterCandidatesCommand command);
}
