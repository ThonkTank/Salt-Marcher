package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.generation.value.EncounterDraft;

import java.util.List;

record EncounterGenerationPreparationUseCase(
        EncounterGenerationUseCase.GenerateStatus status,
        @Nullable EncounterBudgetSummary budget,
        List<EncounterDraft> drafts,
        String message
) {

    boolean success() {
        return status.isSuccessful();
    }

    static EncounterGenerationPreparationUseCase success(
            EncounterBudgetSummary budget,
            List<EncounterDraft> drafts
    ) {
        return new EncounterGenerationPreparationUseCase(
                EncounterGenerationUseCase.GenerateStatus.successfulStatus(),
                budget,
                drafts,
                "Encounter options generated.");
    }

    static EncounterGenerationPreparationUseCase failure(
            EncounterGenerationUseCase.GenerateStatus status,
            @Nullable EncounterBudgetSummary budget,
            String message
    ) {
        return new EncounterGenerationPreparationUseCase(status, budget, List.of(), message);
    }
}
