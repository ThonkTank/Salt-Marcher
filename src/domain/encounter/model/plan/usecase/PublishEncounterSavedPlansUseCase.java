package src.domain.encounter.model.plan.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;

public final class PublishEncounterSavedPlansUseCase {

    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";

    private final EncounterPlanPublishedStateRepository repository;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;

    public PublishEncounterSavedPlansUseCase(
            EncounterPlanPublishedStateRepository repository,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase
    ) {
        this.repository = java.util.Objects.requireNonNull(repository, "repository");
        this.listSavedPlansUseCase = listSavedPlansUseCase;
    }

    public void execute() {
        repository.publishSavedPlans(listSavedPlansUseCase == null
                ? SavedEncounterPlansLoadResult.storageError(PLAN_STORAGE_NOT_REGISTERED)
                : listSavedPlansUseCase.execute());
    }
}
