package src.domain.encounter.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;

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
                ? new SavedEncounterPlanListResult(
                        SavedEncounterPlanStatus.storageErrorStatus(),
                        List.of(),
                        PLAN_STORAGE_NOT_REGISTERED)
                : toSavedPlansResult(listSavedPlansUseCase.execute()));
    }

    private static SavedEncounterPlanListResult toSavedPlansResult(ListSavedEncounterPlansUseCase.Result result) {
        if (result == null) {
            return new SavedEncounterPlanListResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    List.of(),
                    PLAN_STORAGE_NOT_REGISTERED);
        }
        return new SavedEncounterPlanListResult(
                result.status().loadedSuccessfully()
                        ? SavedEncounterPlanStatus.successStatus()
                        : SavedEncounterPlanStatus.storageErrorStatus(),
                result.plans().stream().map(EncounterPlanPublicationUseCase::toPublishedSummary).toList(),
                result.message());
    }
}
