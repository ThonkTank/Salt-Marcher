package src.domain.encounter.runtime.service;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.EncounterPlanBoundaryTranslator;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;

final class EncounterPlanPublicationAccess {

    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";
    private static final String PLAN_BUDGET_LOAD_FAILED = "Encounter plan budget could not be loaded.";

    private final EncounterPlanPublishedStateRepository publishedStateRepository;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;
    private final @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase;

    EncounterPlanPublicationAccess(
            EncounterPlanPublishedStateRepository publishedStateRepository,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase,
            @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase
    ) {
        this.publishedStateRepository = publishedStateRepository;
        this.listSavedPlansUseCase = listSavedPlansUseCase;
        this.loadPlanBudgetUseCase = loadPlanBudgetUseCase;
    }

    void publishSavedPlans() {
        ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
        if (useCase == null) {
            publishedStateRepository.publishSavedPlans(new SavedEncounterPlanListResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    List.of(),
                    PLAN_STORAGE_NOT_REGISTERED));
            return;
        }
        ListSavedEncounterPlansUseCase.Result result = useCase.execute();
        publishedStateRepository.publishSavedPlans(new SavedEncounterPlanListResult(
                EncounterPlanBoundaryTranslator.toPublishedListPlansStatus(result.status()),
                result.plans().stream().map(EncounterPlanBoundaryTranslator::toPublishedChoice).toList(),
                result.message()));
    }

    void publishPlanBudget(long planId) {
        if (loadPlanBudgetUseCase == null) {
            publishedStateRepository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    PLAN_BUDGET_NOT_REGISTERED));
            return;
        }
        try {
            publishedStateRepository.publishPlanBudget(toPublished(loadPlanBudgetUseCase.execute(planId)));
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishPlanBudget(new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    PLAN_BUDGET_LOAD_FAILED));
        }
    }

    private static EncounterPlanBudgetResult toPublished(LoadEncounterPlanBudgetUseCase.Result result) {
        LoadEncounterPlanBudgetUseCase.Result safeResult = result == null
                ? LoadEncounterPlanBudgetUseCase.Result.storageError("")
                : result;
        EncounterPlanBudgetSummary summary = safeResult.summary() == null
                ? null
                : new EncounterPlanBudgetSummary(
                        safeResult.summary().planId(),
                        safeResult.summary().name(),
                        safeResult.summary().generatedLabel(),
                        safeResult.summary().creatureCount(),
                        safeResult.summary().totalBaseXp(),
                        safeResult.summary().adjustedXp(),
                        safeResult.summary().xpMultiplier(),
                        safeResult.summary().difficultyLabel());
        return new EncounterPlanBudgetResult(
                EncounterPlanBudgetStatus.valueOf(safeResult.status().name()),
                summary,
                safeResult.message());
    }
}
