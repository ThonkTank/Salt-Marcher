package src.domain.encounter;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.EncounterBudgetBoundaryTranslator;
import src.domain.encounter.application.EncounterStateSnapshotProjector;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.session.entity.EncounterSession;

final class EncounterSessionPublicationAccess {

    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";
    private static final String TUNING_PREVIEW_NOT_REGISTERED = "Encounter tuning preview service is not registered.";
    private static final String TUNING_PREVIEW_LOAD_FAILED = "Encounter tuning preview could not be loaded.";

    private final EncounterSessionPublishedStateRepository publishedStateRepository;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;

    EncounterSessionPublicationAccess(
            EncounterSessionPublishedStateRepository publishedStateRepository,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
    ) {
        this.publishedStateRepository = publishedStateRepository;
        this.loadBudgetUseCase = loadBudgetUseCase;
    }

    void publishCurrentSession(@Nullable EncounterSession session) {
        publishedStateRepository.publishCurrentSession(
                session == null
                        ? EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED)
                        : EncounterStateSnapshotProjector.toPublishedSnapshot(session),
                session == null
                        ? EncounterBuilderInputs.empty()
                        : EncounterStateSnapshotProjector.toPublishedBuilderInputs(session),
                loadTuningPreviewResult());
    }

    private EncounterTuningPreviewResult loadTuningPreviewResult() {
        if (loadBudgetUseCase == null) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(null),
                    TUNING_PREVIEW_NOT_REGISTERED);
        }
        try {
            LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
            return new EncounterTuningPreviewResult(
                    result.status(),
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(result.budget()),
                    result.message());
        } catch (IllegalStateException exception) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(null),
                    TUNING_PREVIEW_LOAD_FAILED);
        }
    }
}
