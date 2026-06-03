package src.domain.encounter.model.session.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.EncounterBudgetSummary;
import src.domain.encounter.model.generation.EncounterGeneratedAlternative;
import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.encounter.model.generation.EncounterGenerationResult;
import src.domain.encounter.model.plan.EncounterPlan;
import src.domain.encounter.model.plan.EncounterPlanCreature;
import src.domain.encounter.model.plan.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.session.BudgetData;
import src.domain.encounter.model.session.GeneratedEncounterData;
import src.domain.encounter.model.session.GenerationResultData;
import src.domain.encounter.model.session.ListPlansOutcome;
import src.domain.encounter.model.session.PartyBudgetFacts;
import src.domain.encounter.model.session.PlanOutcome;

public final class EncounterSessionUseCaseAdaptersRepository {

    private static final String STORAGE_NOT_REGISTERED_MESSAGE = "Encounter plan storage is not registered.";
    private static final String PLAN_INVALID_MESSAGE = "Encounter plan is invalid.";
    private static final String PLAN_SAVE_FAILED_MESSAGE = "Encounter plan could not be saved.";
    private static final String PLAN_ID_INVALID_MESSAGE = "Encounter plan id must be positive.";
    private static final String PLAN_LOAD_FAILED_MESSAGE = "Encounter plan could not be loaded.";

    private final @Nullable EncounterGenerationRepository generator;
    private final @Nullable EncounterBudgetLoader budgetLoader;
    private final @Nullable EncounterPlanSaver planSaver;
    private final @Nullable EncounterPlanLoader planLoader;
    private final @Nullable EncounterPlanLister planLister;

    public EncounterSessionUseCaseAdaptersRepository(
            @Nullable EncounterGenerationRepository generator,
            @Nullable EncounterBudgetLoader budgetLoader,
            @Nullable EncounterPlanSaver planSaver,
            @Nullable EncounterPlanLoader planLoader,
            @Nullable EncounterPlanLister planLister
    ) {
        this.generator = generator;
        this.budgetLoader = budgetLoader;
        this.planSaver = planSaver;
        this.planLoader = planLoader;
        this.planLister = planLister;
    }

    Optional<BudgetData> loadBudget(EncounterSessionDataMapperRepository dataMapper) {
        EncounterBudgetLoader loader = budgetLoader;
        if (loader == null) {
            return Optional.empty();
        }
        try {
            EncounterBudgetLoadResult result = loader.loadBudget();
            return result.status().isSuccess()
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
        EncounterGenerationRepository useCase = generator;
        if (useCase == null) {
            return new GenerationResultData(
                    false,
                    List.of(),
                    "Encounter generator service is not registered.",
                    Optional.empty(),
                    false);
        }
        try {
            EncounterGenerationResult result = useCase.execute(request);
            List<GeneratedEncounterData> encounters = new ArrayList<>();
            for (EncounterGeneratedAlternative encounter : result.encounters()) {
                encounters.add(dataMapper.toGeneratedEncounter(
                        encounter,
                        result.autoResolved(),
                        result.fallbackUsed()));
            }
            return new GenerationResultData(
                    result.success(),
                    List.copyOf(encounters),
                    result.message(),
                    dataMapper.toDiagnostics(result.diagnostics()),
                    result.fallbackUsed());
        } catch (IllegalStateException exception) {
            return new GenerationResultData(false, List.of(), "Encounter generation failed.", Optional.empty(), false);
        }
    }

    PlanOutcome savePlan(EncounterPlan plan, EncounterSessionDataMapperRepository dataMapper) {
        EncounterPlanSaver saver = planSaver;
        if (saver == null) {
            return new PlanOutcome(Optional.empty(), STORAGE_NOT_REGISTERED_MESSAGE);
        }
        try {
            EncounterPlan savedPlan = saver.savePlan(
                    Math.max(0L, plan.id()),
                    plan.name(),
                    plan.generatedLabel(),
                    plan.creatures());
            return new PlanOutcome(Optional.of(savedPlan), "Encounter saved.");
        } catch (IllegalArgumentException exception) {
            return new PlanOutcome(Optional.empty(), dataMapper.defaultMessage(
                    exception.getMessage(),
                    PLAN_INVALID_MESSAGE));
        } catch (IllegalStateException exception) {
            return new PlanOutcome(Optional.empty(), dataMapper.defaultMessage(
                    exception.getMessage(),
                    PLAN_SAVE_FAILED_MESSAGE));
        }
    }

    PlanOutcome loadPlan(long planId, EncounterSessionDataMapperRepository dataMapper) {
        EncounterPlanLoader loader = planLoader;
        if (loader == null) {
            return new PlanOutcome(Optional.empty(), STORAGE_NOT_REGISTERED_MESSAGE);
        }
        try {
            Optional<EncounterPlan> loadedPlan = loader.loadPlan(planId);
            return loadedPlan.isPresent()
                    ? new PlanOutcome(loadedPlan, "Encounter loaded.")
                    : new PlanOutcome(Optional.empty(), "Encounter plan not found.");
        } catch (IllegalArgumentException exception) {
            return new PlanOutcome(Optional.empty(), dataMapper.defaultMessage(
                    exception.getMessage(),
                    PLAN_ID_INVALID_MESSAGE));
        } catch (IllegalStateException exception) {
            return new PlanOutcome(Optional.empty(), dataMapper.defaultMessage(
                    exception.getMessage(),
                    PLAN_LOAD_FAILED_MESSAGE));
        }
    }

    ListPlansOutcome listPlans() {
        EncounterPlanLister lister = planLister;
        if (lister == null) {
            return new ListPlansOutcome(false, List.of(), STORAGE_NOT_REGISTERED_MESSAGE);
        }
        try {
            SavedEncounterPlansLoadResult result = lister.listPlans();
            return new ListPlansOutcome(
                    result.loadedSuccessfully(),
                    result.plans(),
                    result.message());
        } catch (IllegalStateException exception) {
            return new ListPlansOutcome(false, List.of(), STORAGE_NOT_REGISTERED_MESSAGE);
        }
    }

    public interface EncounterBudgetLoader {
        EncounterBudgetLoadResult loadBudget();
    }

    public record EncounterBudgetLoadResult(
            PartyBudgetFacts.Status status,
            EncounterBudgetSummary budget
    ) {
    }

    public interface EncounterPlanSaver {
        EncounterPlan savePlan(long planId, String name, String generatedLabel, List<EncounterPlanCreature> creatures);
    }

    public interface EncounterPlanLoader {
        Optional<EncounterPlan> loadPlan(long planId);
    }

    public interface EncounterPlanLister {
        SavedEncounterPlansLoadResult listPlans();
    }
}
