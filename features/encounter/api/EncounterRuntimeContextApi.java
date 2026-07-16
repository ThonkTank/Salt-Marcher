package features.encounter.api;

import java.util.concurrent.CompletionStage;

public interface EncounterRuntimeContextApi {

    CompletionStage<EncounterRuntimeContextSyncResult> synchronize(
            SynchronizeEncounterRuntimeContextsCommand command);
}
