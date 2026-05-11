package src.domain.encounter.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterGenerationDiagnosticsData;

record EncounterGenerationPreparationUseCase(
        boolean success,
        List<EncounterDraft> drafts,
        String message,
        @Nullable EncounterGenerationDiagnosticsData diagnostics,
        boolean autoResolved,
        boolean fallbackUsed
) {

    EncounterGenerationPreparationUseCase {
        drafts = drafts == null ? List.of() : List.copyOf(drafts);
        message = message == null ? "" : message;
    }

    static EncounterGenerationPreparationUseCase success(
            List<EncounterDraft> drafts
    ) {
        return success(
                drafts,
                "Encounter options generated.",
                null,
                false,
                false);
    }

    static EncounterGenerationPreparationUseCase success(
            List<EncounterDraft> drafts,
            String message,
            @Nullable EncounterGenerationDiagnosticsData diagnostics,
            boolean autoResolved,
            boolean fallbackUsed
    ) {
        return new EncounterGenerationPreparationUseCase(
                true,
                drafts,
                message,
                diagnostics,
                autoResolved,
                fallbackUsed);
    }

    static EncounterGenerationPreparationUseCase failure(String message) {
        return new EncounterGenerationPreparationUseCase(false, List.of(), message, null, false, false);
    }
}
