package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterStateSnapshot;

public final class PublishEncounterSessionUseCase {

    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";

    private final EncounterSessionPublishedStateRepository repository;
    private final EncounterTuningPreviewPublicationUseCase tuningPreviewPublication;

    public PublishEncounterSessionUseCase(
            EncounterSessionPublishedStateRepository repository,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
    ) {
        this.repository = java.util.Objects.requireNonNull(repository, "repository");
        this.tuningPreviewPublication = new EncounterTuningPreviewPublicationUseCase(loadBudgetUseCase);
    }

    public void execute(@Nullable EncounterSession session) {
        repository.publishCurrentSession(
                session == null
                        ? EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED)
                        : EncounterSessionSnapshotPublicationUseCase.toPublishedSnapshot(session),
                session == null
                        ? EncounterBuilderInputs.empty()
                        : EncounterSessionSnapshotPublicationUseCase.toPublishedBuilderInputs(session),
                tuningPreviewPublication.toResult());
    }
}
