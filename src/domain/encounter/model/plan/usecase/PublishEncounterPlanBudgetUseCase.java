package src.domain.encounter.model.plan.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;

public final class PublishEncounterPlanBudgetUseCase {

    private static final String PLAN_BUDGET_LOAD_FAILED = "Encounter plan budget could not be loaded.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

    private final EncounterPlanPublishedStateRepository repository;
    private final @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase;

    public PublishEncounterPlanBudgetUseCase(
            EncounterPlanPublishedStateRepository repository,
            @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase
    ) {
        this.repository = java.util.Objects.requireNonNull(repository, "repository");
        this.loadPlanBudgetUseCase = loadPlanBudgetUseCase;
    }

    public void execute(long planId) {
        LoadEncounterPlanBudgetUseCase useCase = loadPlanBudgetUseCase;
        if (useCase == null) {
            repository.publishPlanBudget(EncounterPlanBudgetLoadResult.storageError(PLAN_BUDGET_NOT_REGISTERED));
            return;
        }
        try {
            repository.publishPlanBudget(useCase.execute(planId));
        } catch (IllegalStateException exception) {
            repository.publishPlanBudget(EncounterPlanBudgetLoadResult.storageError(PLAN_BUDGET_LOAD_FAILED));
        }
    }
}
