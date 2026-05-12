package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;

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
            repository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    PLAN_BUDGET_NOT_REGISTERED));
            return;
        }
        try {
            repository.publishPlanBudget(toPlanBudgetResult(useCase.execute(planId)));
        } catch (IllegalStateException exception) {
            repository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    PLAN_BUDGET_LOAD_FAILED));
        }
    }

    private static EncounterPlanBudgetResult toPlanBudgetResult(LoadEncounterPlanBudgetUseCase.Result result) {
        if (result == null) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    PLAN_BUDGET_NOT_REGISTERED);
        }
        return new EncounterPlanBudgetResult(
                result.status(),
                result.summary(),
                result.message());
    }
}
