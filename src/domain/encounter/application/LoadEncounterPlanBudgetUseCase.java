package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.policy.EncounterDifficultyTargets;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.reference.port.EncounterCreatureLookup;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;

public final class LoadEncounterPlanBudgetUseCase {

    private static final long MIN_PLAN_ID = 1L;

    private final EncounterPlanRepository plans;
    private final EncounterPartyFactsRepository party;
    private final EncounterCreatureLookup creatures;

    public LoadEncounterPlanBudgetUseCase(
            EncounterPlanRepository plans,
            EncounterPartyFactsRepository party,
            EncounterCreatureLookup creatures
    ) {
        this.plans = Objects.requireNonNull(plans, "plans");
        this.party = Objects.requireNonNull(party, "party");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
    }

    public Result execute(long planId) {
        if (planId < MIN_PLAN_ID) {
            return Result.invalidRequest("Encounter plan id must be positive.");
        }
        Optional<EncounterPlan> maybePlan = plans.load(planId);
        if (maybePlan.isEmpty()) {
            return Result.notFound("Encounter plan was not found.");
        }
        EncounterPartyFactsRepository.PartyBudgetFacts facts = party.loadPartyBudgetFacts();
        if (facts.status().isStorageError()) {
            return Result.storageError("Party data could not be loaded.");
        }
        if (facts.status().isNoActiveParty()) {
            return Result.noActiveParty("No active party is available.");
        }
        List<Integer> activeLevels = facts.activePartyLevels();
        EncounterPlan plan = maybePlan.get();
        int totalBaseXp = totalBaseXp(plan.creatures());
        int creatureCount = plan.creatureCount();
        EncounterDifficultyMath.Thresholds thresholds = EncounterDifficultyMath.thresholdsFor(activeLevels);
        double multiplier = EncounterDifficultyTargets.multiplierFor(creatureCount, activeLevels.size());
        int adjustedXp = (int) Math.round(totalBaseXp * multiplier);
        return Result.success(new PlanBudgetSummary(
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
            Optional<src.domain.encounter.reference.value.EncounterCreatureReference> reference =
                    creatures.loadCreature(creature.creatureId());
            if (reference.isEmpty()) {
                throw new IllegalStateException("Creature detail could not be loaded for plan budget.");
            }
            total += reference.orElseThrow().xp() * creature.quantity();
        }
        return total;
    }

    private static String difficultyLabel(int adjustedXp, EncounterDifficultyMath.Thresholds thresholds) {
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

    public record Result(
            Status status,
            @Nullable PlanBudgetSummary summary,
            String message
    ) {

        public Result {
            status = status == null ? Status.STORAGE_ERROR : status;
            message = message == null ? "" : message;
        }

        static Result success(PlanBudgetSummary summary) {
            return new Result(Status.SUCCESS, summary, "");
        }

        static Result notFound(String message) {
            return new Result(Status.NOT_FOUND, null, message);
        }

        static Result noActiveParty(String message) {
            return new Result(Status.NO_ACTIVE_PARTY, null, message);
        }

        static Result invalidRequest(String message) {
            return new Result(Status.INVALID_REQUEST, null, message);
        }

        static Result storageError(String message) {
            return new Result(Status.STORAGE_ERROR, null, message);
        }
    }

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        NO_ACTIVE_PARTY,
        INVALID_REQUEST,
        STORAGE_ERROR
    }

    public record PlanBudgetSummary(
            long planId,
            String name,
            String generatedLabel,
            int creatureCount,
            int totalBaseXp,
            int adjustedXp,
            double xpMultiplier,
            String difficultyLabel
    ) {

        public PlanBudgetSummary {
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatureCount = Math.max(0, creatureCount);
            totalBaseXp = Math.max(0, totalBaseXp);
            adjustedXp = Math.max(0, adjustedXp);
            xpMultiplier = xpMultiplier <= 0.0 ? 1.0 : xpMultiplier;
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
        }
    }
}
