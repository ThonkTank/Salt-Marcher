package features.encounter.application;

import java.util.List;
import java.util.Optional;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import features.encounter.domain.generation.EncounterBudgetSummary;
import features.encounter.domain.generation.helper.EncounterDifficultyMathHelper;
import features.encounter.domain.generation.helper.EncounterDifficultyTargetHelper;
import features.encounter.domain.generation.EncounterDifficultyThresholds;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanBudgetLoadResult;
import features.encounter.domain.plan.EncounterPlanBudgetSummaryData;
import features.encounter.domain.plan.EncounterPlanCreature;
import features.encounter.domain.plan.SavedEncounterPlansLoadResult;
import features.encounter.domain.plan.repository.EncounterPlanRepository;
import features.encounter.domain.session.BudgetData;
import features.encounter.domain.session.ListPlansOutcome;
import features.encounter.domain.session.PartyBudgetFacts;
import features.encounter.domain.session.PlanOutcome;

public final class EncounterPlanGateway {

    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("encounter.storage-failure");

    private static final long MIN_PLAN_ID = 1L;
    private static final String STORAGE_NOT_REGISTERED_MESSAGE = "Encounter plan storage is not registered.";
    private static final String PLAN_INVALID_MESSAGE = "Encounter plan is invalid.";
    private static final String PLAN_SAVE_FAILED_MESSAGE = "Encounter plan could not be saved.";
    private static final String PLAN_ID_INVALID_MESSAGE = "Encounter plan id must be positive.";
    private static final String PLAN_LOAD_FAILED_MESSAGE = "Encounter plan could not be loaded.";
    private static final String PLAN_BUDGET_LOAD_FAILED = "Encounter plan budget could not be loaded.";

    private final EncounterPlanRepository plans;
    private final EncounterForeignFacts facts;
    private final Diagnostics diagnostics;

    public EncounterPlanGateway(EncounterPlanRepository plans, EncounterForeignFacts facts, Diagnostics diagnostics) {
        this.plans = java.util.Objects.requireNonNull(plans, "plans");
        this.facts = java.util.Objects.requireNonNull(facts, "facts");
        this.diagnostics = java.util.Objects.requireNonNull(diagnostics, "diagnostics");
    }

    Optional<BudgetData> loadBudget() {
        BudgetResult result = loadBudgetForTuningPreview();
        return result.status().isSuccess() ? Optional.of(toSessionBudget(result.budget())) : Optional.empty();
    }

    BudgetResult loadBudgetForTuningPreview() {
        PartyBudgetFacts budgetFacts = facts.loadPartyBudgetFacts();
        if (budgetFacts.status().isStorageError()) {
            return BudgetResult.storageError();
        }
        if (budgetFacts.status().isNoActiveParty()) {
            return BudgetResult.noActiveParty();
        }
        return BudgetResult.success(EncounterDifficultyMathHelper.summarizeBudget(
                budgetFacts.activePartyLevels(),
                budgetFacts.consumedDailyXp(),
                budgetFacts.totalBudgetXp()));
    }

    PlanOutcome savePlan(EncounterPlan plan) {
        try {
            EncounterPlan savedPlan = plans.save(new EncounterPlan(
                    Math.max(0L, plan.id()),
                    plan.name(),
                    plan.generatedLabel(),
                    plan.creatures()));
            return new PlanOutcome(Optional.of(savedPlan), "Encounter saved.");
        } catch (IllegalArgumentException exception) {
            return new PlanOutcome(Optional.empty(), defaultMessage(exception.getMessage(), PLAN_INVALID_MESSAGE));
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return new PlanOutcome(Optional.empty(), defaultMessage(exception.getMessage(), PLAN_SAVE_FAILED_MESSAGE));
        }
    }

    PlanOutcome loadPlan(long planId) {
        try {
            Optional<EncounterPlan> loadedPlan = loadPlanOrThrow(planId);
            return loadedPlan.isPresent()
                    ? new PlanOutcome(loadedPlan, "Encounter loaded.")
                    : new PlanOutcome(Optional.empty(), "Encounter plan not found.");
        } catch (IllegalArgumentException exception) {
            return new PlanOutcome(Optional.empty(), defaultMessage(exception.getMessage(), PLAN_ID_INVALID_MESSAGE));
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return new PlanOutcome(Optional.empty(), defaultMessage(exception.getMessage(), PLAN_LOAD_FAILED_MESSAGE));
        }
    }

    ListPlansOutcome listPlansForSession() {
        SavedEncounterPlansLoadResult result = listPlans();
        return new ListPlansOutcome(result.loadedSuccessfully(), result.plans(), result.message());
    }

    SavedEncounterPlansLoadResult listPlans() {
        try {
            return SavedEncounterPlansLoadResult.success(plans.list());
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return SavedEncounterPlansLoadResult.storageError("Encounter plans could not be loaded.");
        }
    }

    EncounterPlanBudgetLoadResult loadPlanBudgetForPublication(long planId) {
        try {
            return loadPlanBudget(planId);
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return EncounterPlanBudgetLoadResult.storageError(PLAN_BUDGET_LOAD_FAILED);
        }
    }

    private Optional<EncounterPlan> loadPlanOrThrow(long planId) {
        if (planId <= 0) {
            throw new IllegalArgumentException(PLAN_ID_INVALID_MESSAGE);
        }
        try {
            return plans.load(planId);
        } catch (IllegalStateException exception) {
            throw new IllegalStateException(PLAN_LOAD_FAILED_MESSAGE, exception);
        }
    }

    private EncounterPlanBudgetLoadResult loadPlanBudget(long planId) {
        if (planId < MIN_PLAN_ID) {
            return EncounterPlanBudgetLoadResult.invalidRequest(PLAN_ID_INVALID_MESSAGE);
        }
        Optional<EncounterPlan> maybePlan = plans.load(planId);
        if (maybePlan.isEmpty()) {
            return EncounterPlanBudgetLoadResult.notFound("Encounter plan was not found.");
        }
        PartyBudgetFacts partyFacts = facts.loadPartyBudgetFacts();
        if (partyFacts.status().isStorageError()) {
            return EncounterPlanBudgetLoadResult.storageError("Party data could not be loaded.");
        }
        if (partyFacts.status().isNoActiveParty()) {
            return EncounterPlanBudgetLoadResult.noActiveParty("No active party is available.");
        }
        EncounterPlan plan = maybePlan.get();
        int totalBaseXp = totalBaseXp(plan.creatures());
        int creatureCount = plan.creatureCount();
        EncounterDifficultyThresholds thresholds = EncounterDifficultyMathHelper.thresholdsFor(
                partyFacts.activePartyLevels());
        double multiplier = EncounterDifficultyTargetHelper.multiplierFor(creatureCount, partyFacts.activePartyLevels().size());
        int adjustedXp = (int) Math.round(totalBaseXp * multiplier);
        return EncounterPlanBudgetLoadResult.success(new EncounterPlanBudgetSummaryData(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                creatureCount,
                totalBaseXp,
                adjustedXp,
                multiplier,
                difficultyLabel(adjustedXp, thresholds)));
    }

    private int totalBaseXp(List<EncounterPlanCreature> creaturesInPlan) {
        int total = 0;
        for (EncounterPlanCreature creature : creaturesInPlan == null ? List.<EncounterPlanCreature>of() : creaturesInPlan) {
            Optional<features.encounter.domain.reference.EncounterCreatureReference> reference =
                    facts.loadCreatureReference(creature.creatureId());
            if (reference.isEmpty()) {
                throw new IllegalStateException("Creature detail could not be loaded for plan budget.");
            }
            total += reference.orElseThrow().xp() * creature.quantity();
        }
        return total;
    }

    private static BudgetData toSessionBudget(EncounterBudgetSummary budget) {
        return new BudgetData(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold());
    }

    private static String defaultMessage(String message, String fallback) {
        return message == null || message.isBlank() ? fallback : message;
    }

    private void reportStorageFailure(IllegalStateException exception) {
        diagnostics.failure(STORAGE_FAILURE, exception.getClass());
    }

    private static String difficultyLabel(int adjustedXp, EncounterDifficultyThresholds thresholds) {
        if (adjustedXp >= thresholds.deadly()) {
            return "Deadly";
        }
        if (adjustedXp >= thresholds.hard()) {
            return "Hard";
        }
        if (adjustedXp >= thresholds.medium()) {
            return "Medium";
        }
        return adjustedXp <= 0 ? "" : "Easy";
    }

    record BudgetResult(
            PartyBudgetFacts.Status status,
            EncounterBudgetSummary budget,
            String message
    ) {

        BudgetResult {
            status = status == null ? PartyBudgetFacts.Status.storageErrorStatus() : status;
            message = message == null ? "" : message;
        }

        static BudgetResult success(EncounterBudgetSummary budget) {
            return new BudgetResult(PartyBudgetFacts.Status.successStatus(), budget, "");
        }

        static BudgetResult noActiveParty() {
            return new BudgetResult(
                    PartyBudgetFacts.Status.noActivePartyStatus(),
                    emptyBudget(),
                    "No active party is available.");
        }

        static BudgetResult storageError() {
            return new BudgetResult(
                    PartyBudgetFacts.Status.storageErrorStatus(),
                    emptyBudget(),
                    "Party data could not be loaded.");
        }

        private static EncounterBudgetSummary emptyBudget() {
            return new EncounterBudgetSummary(List.of(), 1, 0, 0, 0, 0, 0, 0, 0);
        }
    }
}
