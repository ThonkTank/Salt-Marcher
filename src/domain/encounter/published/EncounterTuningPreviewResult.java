package src.domain.encounter.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record EncounterTuningPreviewResult(
        EncounterGenerationStatus status,
        EncounterTuningPreviewLabels labels,
        @Nullable String message
) {

    public EncounterTuningPreviewResult {
        status = status == null ? EncounterGenerationStatus.defaultFailure() : status;
        labels = labels == null ? emptyLabels() : labels;
        message = message == null ? "" : message;
    }

    private static EncounterTuningPreviewLabels emptyLabels() {
        return new EncounterTuningPreviewLabels(
                List.of(),
                List.of(),
                List.of(),
                List.of());
    }
}
