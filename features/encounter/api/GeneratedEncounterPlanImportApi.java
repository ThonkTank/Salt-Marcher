package features.encounter.api;

import java.util.concurrent.CompletionStage;

/**
 * Non-blocking boundary for turning generated encounter specifications into saved encounter plans.
 */
public interface GeneratedEncounterPlanImportApi {

    CompletionStage<GeneratedEncounterPlanImportResult> importGeneratedPlans(
            GeneratedEncounterPlanImportCommand command
    );
}
