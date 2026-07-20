package features.creatures.api;

import java.util.concurrent.CompletionStage;

public interface CreaturesApi {

    void refreshReferenceIndex(RefreshCreatureReferenceIndexCommand command);

    void selectCreatureDetail(SelectCreatureDetailCommand command);

    void refreshEncounterCandidates(RefreshCreatureEncounterCandidatesCommand command);

    CompletionStage<CreatureFactsSnapshotResult> loadFacts(CreatureFactsQuery query);
}
