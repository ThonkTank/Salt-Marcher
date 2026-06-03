package src.domain.encounter.model.session;

import java.util.List;
import java.util.Optional;

public record GenerationResultData(
        boolean success,
        List<GeneratedEncounterData> alternatives,
        String message,
        Optional<GenerationDiagnosticsData> diagnostics,
        boolean fallbackUsed
) {
    public GenerationResultData {
        alternatives = alternatives == null ? List.of() : List.copyOf(alternatives);
        message = message == null ? "" : message;
        diagnostics = diagnostics == null ? Optional.empty() : diagnostics;
    }
}
