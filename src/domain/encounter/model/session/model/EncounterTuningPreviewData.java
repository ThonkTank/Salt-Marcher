package src.domain.encounter.model.session.model;

import java.util.List;

public record EncounterTuningPreviewData(
        Status status,
        List<PreviewLabel> easyLabels,
        List<PreviewLabel> mediumLabels,
        List<PreviewLabel> hardLabels,
        List<PreviewLabel> deadlyLabels,
        String message
) {

    public EncounterTuningPreviewData {
        status = status == null ? Status.STORAGE_ERROR : status;
        easyLabels = easyLabels == null ? List.of() : List.copyOf(easyLabels);
        mediumLabels = mediumLabels == null ? List.of() : List.copyOf(mediumLabels);
        hardLabels = hardLabels == null ? List.of() : List.copyOf(hardLabels);
        deadlyLabels = deadlyLabels == null ? List.of() : List.copyOf(deadlyLabels);
        message = message == null ? "" : message;
    }

    public static EncounterTuningPreviewData storageError(String message) {
        return new EncounterTuningPreviewData(Status.STORAGE_ERROR, List.of(), List.of(), List.of(), List.of(), message);
    }

    public enum Status {
        SUCCESS,
        NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }

    public record PreviewLabel(double value, String label) {

        public PreviewLabel {
            label = label == null ? "" : label;
        }
    }
}
