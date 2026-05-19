package src.domain.encounter.model.session.repository;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.plan.usecase.ListSavedEncounterPlansUseCase;
import src.domain.encounter.model.plan.usecase.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.model.plan.usecase.SaveEncounterPlanUseCase;
import src.domain.encounter.model.session.model.BudgetData;
import src.domain.encounter.model.session.model.GenerationResultData;
import src.domain.encounter.model.session.model.ListPlansOutcome;
import src.domain.encounter.model.session.model.PlanOutcome;
import src.domain.encounter.model.session.usecase.LoadEncounterBudgetUseCase;

public final class EncounterSessionUseCaseAdaptersRepository {

    private final @Nullable EncounterGenerationUseCase generator;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable SaveEncounterPlanUseCase savePlanUseCase;
    private final @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;

    public EncounterSessionUseCaseAdaptersRepository(
            @Nullable EncounterGenerationUseCase generator,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase,
            @Nullable SaveEncounterPlanUseCase savePlanUseCase,
            @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase
    ) {
        this.generator = generator;
        this.loadBudgetUseCase = loadBudgetUseCase;
        this.savePlanUseCase = savePlanUseCase;
        this.loadSavedPlanUseCase = loadSavedPlanUseCase;
        this.listSavedPlansUseCase = listSavedPlansUseCase;
    }

    Optional<BudgetData> loadBudget(EncounterSessionDataMapperRepository dataMapper) {
        LoadEncounterBudgetUseCase useCase = loadBudgetUseCase;
        if (useCase == null) {
            return Optional.empty();
        }
        try {
            LoadEncounterBudgetUseCase.Result result = useCase.execute();
            return result.status().isSuccess() && result.budget() != null
                    ? Optional.of(dataMapper.toSessionBudget(result.budget()))
                    : Optional.empty();
        } catch (IllegalStateException exception) {
            return Optional.empty();
        }
    }

    GenerationResultData generate(
            EncounterGenerationRequest request,
            EncounterSessionDataMapperRepository dataMapper
    ) {
        EncounterGenerationUseCase useCase = generator;
        if (useCase == null) {
            return new GenerationResultData(
                    false,
                    List.of(),
                    "Encounter generator service is not registered.",
                    Optional.empty(),
                    false);
        }
        try {
            EncounterGenerationUseCase.GenerateResult result = useCase.execute(request);
            return new GenerationResultData(
                    result.success(),
                    result.encounters().stream()
                            .map(encounter -> dataMapper.toGeneratedEncounter(
                                    encounter,
                                    result.autoResolved(),
                                    result.fallbackUsed()))
                            .toList(),
                    result.message(),
                    dataMapper.toDiagnostics(result.diagnostics()),
                    result.fallbackUsed());
        } catch (IllegalStateException exception) {
            return new GenerationResultData(false, List.of(), "Encounter generation failed.", Optional.empty(), false);
        }
    }

    PlanOutcome savePlan(EncounterPlan plan, EncounterSessionDataMapperRepository dataMapper) {
        SaveEncounterPlanUseCase useCase = savePlanUseCase;
        if (useCase == null) {
            return new PlanOutcome(Optional.empty(), "Encounter plan storage is not registered.");
        }
        try {
            EncounterPlan savedPlan = useCase.execute(
                    Math.max(0L, plan.id()),
                    plan.name(),
                    plan.generatedLabel(),
                    plan.creatures());
            return new PlanOutcome(Optional.of(savedPlan), "Encounter saved.");
        } catch (IllegalArgumentException exception) {
            return new PlanOutcome(Optional.empty(), dataMapper.defaultMessage(
                    exception.getMessage(),
                    "Encounter plan is invalid."));
        } catch (IllegalStateException exception) {
            return new PlanOutcome(Optional.empty(), dataMapper.defaultMessage(
                    exception.getMessage(),
                    "Encounter plan could not be saved."));
        }
    }

    PlanOutcome loadPlan(long planId, EncounterSessionDataMapperRepository dataMapper) {
        LoadSavedEncounterPlanUseCase useCase = loadSavedPlanUseCase;
        if (useCase == null) {
            return new PlanOutcome(Optional.empty(), "Encounter plan storage is not registered.");
        }
        try {
            Optional<EncounterPlan> loadedPlan = useCase.execute(planId);
            return loadedPlan.isPresent()
                    ? new PlanOutcome(loadedPlan, "Encounter loaded.")
                    : new PlanOutcome(Optional.empty(), "Encounter plan not found.");
        } catch (IllegalArgumentException exception) {
            return new PlanOutcome(Optional.empty(), dataMapper.defaultMessage(
                    exception.getMessage(),
                    "Encounter plan id must be positive."));
        } catch (IllegalStateException exception) {
            return new PlanOutcome(Optional.empty(), dataMapper.defaultMessage(
                    exception.getMessage(),
                    "Encounter plan could not be loaded."));
        }
    }

    ListPlansOutcome listPlans() {
        ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
        if (useCase == null) {
            return new ListPlansOutcome(false, List.of(), "Encounter plan storage is not registered.");
        }
        SavedEncounterPlansLoadResult result = useCase.execute();
        return new ListPlansOutcome(
                result.loadedSuccessfully(),
                result.plans(),
                result.message());
    }
}
