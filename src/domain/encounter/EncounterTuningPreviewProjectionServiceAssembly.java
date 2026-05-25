package src.domain.encounter;

import java.util.List;
import src.domain.encounter.model.session.model.EncounterTuningPreviewData;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewResult;

final class EncounterTuningPreviewProjectionServiceAssembly {

    private EncounterTuningPreviewProjectionServiceAssembly() {
    }

    static EncounterTuningPreviewResult toPublishedTuningPreview(EncounterTuningPreviewData data) {
        EncounterTuningPreviewData safeData = data == null ? EncounterTuningPreviewData.storageError("") : data;
        return new EncounterTuningPreviewResult(
                toPublishedStatus(safeData),
                new EncounterTuningPreviewLabels(
                        safeData.difficultyLabels().stream()
                                .map(EncounterTuningPreviewProjectionServiceAssembly::toPublishedLabel)
                                .toList(),
                        safeData.balanceLabels().stream()
                                .map(EncounterTuningPreviewProjectionServiceAssembly::toPublishedLabel)
                                .toList(),
                        safeData.amountLabels().stream()
                                .map(EncounterTuningPreviewProjectionServiceAssembly::toPublishedLabel)
                                .toList(),
                        safeData.diversityLabels().stream()
                                .map(EncounterTuningPreviewProjectionServiceAssembly::toPublishedLabel)
                                .toList()),
                safeData.message());
    }

    static EncounterTuningPreviewResult emptyTuningPreview() {
        return new EncounterTuningPreviewResult(
                EncounterGenerationStatus.STORAGE_ERROR,
                new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                "");
    }

    private static EncounterGenerationStatus toPublishedStatus(EncounterTuningPreviewData data) {
        if (data.available()) {
            return EncounterGenerationStatus.successStatus();
        }
        if (data.activePartyMissing()) {
            return EncounterGenerationStatus.noActivePartyStatus();
        }
        return EncounterGenerationStatus.defaultFailure();
    }

    private static EncounterTuningPreviewLabels.PreviewLabel toPublishedLabel(
            EncounterTuningPreviewData.PreviewPoint label
    ) {
        return new EncounterTuningPreviewLabels.PreviewLabel(label.value(), label.label());
    }
}
