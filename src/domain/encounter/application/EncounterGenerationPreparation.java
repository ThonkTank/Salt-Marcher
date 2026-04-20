package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.generation.value.EncounterDraft;

import java.util.List;

record EncounterGenerationPreparation(
        EncounterGenerationUseCase.GenerateStatus status,
        @Nullable EncounterBudgetSummary budget,
        List<EncounterDraft> drafts,
        String message
) {

    boolean success() {
        return status.isSuccessful();
    }

    static EncounterGenerationPreparation success(
            EncounterBudgetSummary budget,
            List<EncounterDraft> drafts
    ) {
        return new EncounterGenerationPreparation(
                EncounterGenerationUseCase.GenerateStatus.successfulStatus(),
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
