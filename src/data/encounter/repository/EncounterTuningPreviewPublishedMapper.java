package src.data.encounter.repository;

import src.domain.encounter.model.session.model.EncounterTuningPreviewData;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewResult;

final class EncounterTuningPreviewPublishedMapper {

    private EncounterTuningPreviewPublishedMapper() {
    }

    static EncounterTuningPreviewResult toPublishedTuningPreview(EncounterTuningPreviewData data) {
        EncounterTuningPreviewData safeData = data == null ? EncounterTuningPreviewData.storageError("") : data;
        return new EncounterTuningPreviewResult(
                toPublishedStatus(safeData.status()),
                new EncounterTuningPreviewLabels(
                        safeData.easyLabels().stream().map(EncounterTuningPreviewPublishedMapper::toPublishedLabel).toList(),
                        safeData.mediumLabels().stream().map(EncounterTuningPreviewPublishedMapper::toPublishedLabel).toList(),
                        safeData.hardLabels().stream().map(EncounterTuningPreviewPublishedMapper::toPublishedLabel).toList(),
                        safeData.deadlyLabels().stream().map(EncounterTuningPreviewPublishedMapper::toPublishedLabel).toList()),
                safeData.message());
    }

    private static EncounterGenerationStatus toPublishedStatus(EncounterTuningPreviewData.Status status) {
        return switch (status == null ? EncounterTuningPreviewData.Status.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterGenerationStatus.successStatus();
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.noActivePartyStatus();
            case STORAGE_ERROR -> EncounterGenerationStatus.defaultFailure();
        };
    }

    private static EncounterTuningPreviewLabels.PreviewLabel toPublishedLabel(EncounterTuningPreviewData.PreviewLabel label) {
        return new EncounterTuningPreviewLabels.PreviewLabel(label.value(), label.label());
    }
}
