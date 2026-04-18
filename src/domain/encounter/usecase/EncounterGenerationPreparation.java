package src.domain.encounter.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.api.EncounterBudgetSummary;

import java.util.List;
import java.util.Map;

record EncounterGenerationPreparation(
        EncounterGenerationUseCase.GenerateStatus status,
        @Nullable EncounterBudgetSummary budget,
        List<EncounterDraft> drafts,
        String message
) {

    boolean success() {
        return status == EncounterGenerationUseCase.GenerateStatus.SUCCESS;
    }

    static EncounterGenerationPreparation success(
            EncounterBudgetSummary budget,
            List<EncounterDraft> drafts
    ) {
        return new EncounterGenerationPreparation(
                EncounterGenerationUseCase.GenerateStatus.SUCCESS,
                budget,
                drafts,
                "Encounter options generated.");
    }

    static EncounterGenerationPreparation failure(
            EncounterGenerationUseCase.GenerateStatus status,
            @Nullable EncounterBudgetSummary budget,
            String message
    ) {
        return new EncounterGenerationPreparation(status, budget, List.of(), message);
    }
}
