package src.domain.encounter.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterGenerationAdvisory;
import src.domain.encounter.published.EncounterGenerationDiagnostics;
import src.domain.encounter.published.EncounterGenerationStatus;

record EncounterGenerationPreparationUseCase(
        EncounterGenerationStatus status,
        @Nullable EncounterBudgetSummary budget,
        List<EncounterDraft> drafts,
        String message,
        @Nullable EncounterGenerationDiagnostics diagnostics,
        List<EncounterGenerationAdvisory> advisories
) {

    EncounterGenerationPreparationUseCase {
        status = status == null ? EncounterGenerationStatus.defaultFailure() : status;
        drafts = drafts == null ? List.of() : List.copyOf(drafts);
        message = message == null ? "" : message;
        advisories = advisories == null ? List.of() : List.copyOf(advisories);
    }

    boolean success() {
        return status == EncounterGenerationStatus.SUCCESS;
    }

    static EncounterGenerationPreparationUseCase success(
            EncounterBudgetSummary budget,
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
            EncounterBudgetSummary budget,
            List<EncounterDraft> drafts,
            String message,
            @Nullable EncounterGenerationDiagnostics diagnostics,
            List<EncounterGenerationAdvisory> advisories
    ) {
        return new EncounterGenerationPreparationUseCase(
                EncounterGenerationStatus.SUCCESS,
                budget,
                drafts,
                message,
                diagnostics,
                advisories);
    }

    static EncounterGenerationPreparationUseCase failure(
            EncounterGenerationStatus status,
            @Nullable EncounterBudgetSummary budget,
            String message
    ) {
        return new EncounterGenerationPreparationUseCase(status, budget, List.of(), message, null, List.of());
    }
}
