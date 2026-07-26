package features.encounter.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.encounter.api.EncounterGenerationStatus;
import features.encounter.api.EncounterPlanBudgetStatus;
import features.encounter.domain.plan.EncounterPlanBudgetLoadResult;
import org.junit.jupiter.api.Test;

final class EncounterMissingPartyLevelProjectionTest {

    private static final String MESSAGE =
            "Every active party member needs a level before encounter budgeting.";

    @Test
    void missingLevelRemainsDistinctInPublishedBudgetStatusAndMessage() {
        var result = EncounterProjection.planBudget(
                EncounterPlanBudgetLoadResult.missingRequiredLevel(MESSAGE));

        assertEquals(EncounterPlanBudgetStatus.MISSING_REQUIRED_LEVEL, result.status());
        assertEquals(MESSAGE, result.message());
    }

    @Test
    void missingLevelRemainsDistinctInVisibleTuningStatusAndMessage() {
        var preview = EncounterProjection.tuningPreview(EncounterProjection.tuningPreviewData(
                EncounterPlanGateway.BudgetResult.missingRequiredLevel()));

        assertEquals(EncounterGenerationStatus.MISSING_REQUIRED_LEVEL, preview.status());
        assertEquals(MESSAGE, preview.message());
    }
}
