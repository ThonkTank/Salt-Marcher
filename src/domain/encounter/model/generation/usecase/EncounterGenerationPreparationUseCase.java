package src.domain.encounter.model.generation.usecase;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.EncounterDraft;
import src.domain.encounter.model.generation.EncounterGenerationDiagnosticsData;

public record EncounterGenerationPreparationUseCase(
        boolean success,
        List<EncounterDraft> drafts,
        String message,
        @Nullable EncounterGenerationDiagnosticsData diagnostics,
        boolean autoResolved,
        boolean fallbackUsed
) {

    public EncounterGenerationPreparationUseCase {
        drafts = drafts == null ? List.of() : List.copyOf(drafts);
        message = message == null ? "" : message;
    }

    public static EncounterGenerationPreparationUseCase success(
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

    public static EncounterGenerationPreparationUseCase failure(String message) {
        return new EncounterGenerationPreparationUseCase(false, List.of(), message, null, false, false);
    }
}
