package src.domain.encounter.model.session;

import src.domain.encounter.model.generation.EncounterGenerationInputs;

public record EncounterSessionPublicationData(
        EncounterSessionSnapshotData snapshot,
        EncounterGenerationInputs builderInputs,
        EncounterTuningPreviewData tuningPreview,
        String unavailableMessage
) {

    public EncounterSessionPublicationData {
        builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
        tuningPreview = tuningPreview == null ? EncounterTuningPreviewData.storageError("") : tuningPreview;
        unavailableMessage = unavailableMessage == null ? "" : unavailableMessage;
    }

    public static EncounterSessionPublicationData unavailable(String message) {
        return new EncounterSessionPublicationData(
                null,
                EncounterGenerationInputs.empty(),
                EncounterTuningPreviewData.storageError(""),
                message);
    }
}
