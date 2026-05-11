package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.helper.EncounterDifficultyMathHelper;
import src.domain.encounter.model.generation.helper.EncounterDifficultyTargetHelper;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.model.plan.model.EncounterPlanCreature;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;

public final class LoadEncounterPlanBudgetUseCase {

    private static final long MIN_PLAN_ID = 1L;

    private final EncounterPlanRepository plans;
    private final EncounterPartyFactsRepository party;
    private final EncounterCreatureRepository creatures;

    public LoadEncounterPlanBudgetUseCase(
            EncounterPlanRepository plans,
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures
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
        EncounterDifficultyMathHelper.Thresholds thresholds = EncounterDifficultyMathHelper.thresholdsFor(activeLevels);
        double multiplier = EncounterDifficultyTargetHelper.multiplierFor(creatureCount, activeLevels.size());
        int adjustedXp = (int) Math.round(totalBaseXp * multiplier);
        return Result.success(new EncounterPlanBudgetSummary(
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
            Optional<src.domain.encounter.model.reference.model.EncounterCreatureReference> reference =
                    creatures.loadCreature(creature.creatureId());
            if (reference.isEmpty()) {
                throw new IllegalStateException("Creature detail could not be loaded for plan budget.");
            }
            total += reference.orElseThrow().xp() * creature.quantity();
        }
        return total;
    }

    private static String difficultyLabel(int adjustedXp, EncounterDifficultyMathHelper.Thresholds thresholds) {
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
            EncounterPlanBudgetStatus status,
            @Nullable EncounterPlanBudgetSummary summary,
            String message
    ) {

        public Result {
            status = status == null ? EncounterPlanBudgetStatus.STORAGE_ERROR : status;
            message = message == null ? "" : message;
        }

        static Result success(EncounterPlanBudgetSummary summary) {
            return new Result(EncounterPlanBudgetStatus.SUCCESS, summary, "");
        }

        static Result notFound(String message) {
            return new Result(EncounterPlanBudgetStatus.NOT_FOUND, null, message);
        }

        static Result noActiveParty(String message) {
            return new Result(EncounterPlanBudgetStatus.NO_ACTIVE_PARTY, null, message);
        }

        static Result invalidRequest(String message) {
            return new Result(EncounterPlanBudgetStatus.INVALID_REQUEST, null, message);
        }

        static Result storageError(String message) {
            return new Result(EncounterPlanBudgetStatus.STORAGE_ERROR, null, message);
        }
    }
}
