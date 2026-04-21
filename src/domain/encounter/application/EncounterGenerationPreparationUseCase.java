package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.EncounterGenerationUseCase.BudgetSummary;
import src.domain.encounter.application.EncounterGenerationUseCase.GenerationDiagnostics;
import src.domain.encounter.generation.value.EncounterDraft;

import java.util.List;

record EncounterGenerationPreparationUseCase(
        EncounterGenerationUseCase.GenerateStatus status,
        @Nullable BudgetSummary budget,
        List<EncounterDraft> drafts,
        String message,
        @Nullable GenerationDiagnostics diagnostics,
        List<EncounterGenerationUseCase.GenerationAdvisory> advisories
) {

    EncounterGenerationPreparationUseCase {
        drafts = drafts == null ? List.of() : List.copyOf(drafts);
        message = message == null ? "" : message;
        advisories = advisories == null ? List.of() : List.copyOf(advisories);
    }

    boolean success() {
        return status.isSuccessful();
    }

    static EncounterGenerationPreparationUseCase success(
            EncounterGenerationUseCase.BudgetSummary budget,
            List<EncounterDraft> drafts
    ) {
        return success(
                budget,
                drafts,
                "Encounter options generated.",
                null,
                List.of());
    }

    static EncounterGenerationPreparationUseCase success(
            EncounterGenerationUseCase.BudgetSummary budget,
            List<EncounterDraft> drafts,
            String message,
            @Nullable GenerationDiagnostics diagnostics,
            List<EncounterGenerationUseCase.GenerationAdvisory> advisories
    ) {
        return new EncounterGenerationPreparationUseCase(
                EncounterGenerationUseCase.GenerateStatus.successfulStatus(),
                budget,
                drafts,
                message,
                diagnostics,
                advisories);
    }

    static EncounterGenerationPreparationUseCase failure(
            EncounterGenerationUseCase.GenerateStatus status,
            @Nullable BudgetSummary budget,
            String message
    ) {
        return new EncounterGenerationPreparationUseCase(status, budget, List.of(), message, null, List.of());
    }
}
