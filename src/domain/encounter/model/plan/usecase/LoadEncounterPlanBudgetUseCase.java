package src.domain.encounter.model.plan.usecase;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.encounter.model.generation.helper.EncounterDifficultyMathHelper;
import src.domain.encounter.model.generation.helper.EncounterDifficultyTargetHelper;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetSummaryData;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.model.plan.model.EncounterPlanCreature;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;

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

    public EncounterPlanBudgetLoadResult execute(long planId) {
        if (planId < MIN_PLAN_ID) {
            return EncounterPlanBudgetLoadResult.invalidRequest("Encounter plan id must be positive.");
        }
        Optional<EncounterPlan> maybePlan = plans.load(planId);
        if (maybePlan.isEmpty()) {
            return EncounterPlanBudgetLoadResult.notFound("Encounter plan was not found.");
        }
        EncounterPartyFactsRepository.PartyBudgetFacts facts = party.loadPartyBudgetFacts();
        if (facts.status().isStorageError()) {
            return EncounterPlanBudgetLoadResult.storageError("Party data could not be loaded.");
        }
        if (facts.status().isNoActiveParty()) {
            return EncounterPlanBudgetLoadResult.noActiveParty("No active party is available.");
        }
        List<Integer> activeLevels = facts.activePartyLevels();
        EncounterPlan plan = maybePlan.get();
        int totalBaseXp = totalBaseXp(plan.creatures());
        int creatureCount = plan.creatureCount();
        EncounterDifficultyThresholds thresholds = EncounterDifficultyMathHelper.thresholdsFor(activeLevels);
        double multiplier = EncounterDifficultyTargetHelper.multiplierFor(creatureCount, activeLevels.size());
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
            Optional<src.domain.encounter.model.reference.model.EncounterCreatureReference> reference =
                    creatures.loadCreature(creature.creatureId());
            if (reference.isEmpty()) {
                throw new IllegalStateException("Creature detail could not be loaded for plan budget.");
            }
            total += reference.orElseThrow().xp() * creature.quantity();
        }
        return total;
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

}
