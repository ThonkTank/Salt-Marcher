package src.domain.encounter.model.session.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.EncounterSessionPublicationData;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;

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
        repository.publishCurrentSession(session == null
                ? EncounterSessionPublicationData.unavailable(SESSION_NOT_REGISTERED)
                : new EncounterSessionPublicationData(
                        session.snapshot(),
                        session.builderInputs(),
                        tuningPreviewPublication.toData(),
                        ""));
    }
}
