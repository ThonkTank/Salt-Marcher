package src.domain.encounter.model.generation;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record EncounterGenerationResult(
        boolean success,
        List<EncounterGeneratedAlternative> encounters,
        String message,
        @Nullable EncounterGenerationDiagnosticsData diagnostics,
        boolean autoResolved,
        boolean fallbackUsed
) {

    public EncounterGenerationResult {
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        message = message == null ? "" : message;
    }

}
