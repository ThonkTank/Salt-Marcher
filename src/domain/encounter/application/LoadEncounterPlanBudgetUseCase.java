package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.policy.EncounterDifficultyTargets;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;

public final class LoadEncounterPlanBudgetUseCase {

    private static final long MIN_PLAN_ID = 1L;

    private final EncounterPlanRepository plans;
    private final EncounterPartyFactsRepository party;
    private final CreaturesApplicationService creatures;

    public LoadEncounterPlanBudgetUseCase(
            EncounterPlanRepository plans,
            EncounterPartyFactsRepository party,
            CreaturesApplicationService creatures
    ) {
        this.plans = Objects.requireNonNull(plans, "plans");
        this.party = Objects.requireNonNull(party, "party");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
    }

    public EncounterPlanBudgetResult execute(long planId) {
        if (planId < MIN_PLAN_ID) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.INVALID_REQUEST,
                    null,
                    "Encounter plan id must be positive.");
        }
        Optional<EncounterPlan> maybePlan = plans.load(planId);
        if (maybePlan.isEmpty()) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.NOT_FOUND,
                    null,
                    "Encounter plan was not found.");
        }
        EncounterPartyFactsRepository.PartyBudgetFacts facts = party.loadPartyBudgetFacts();
        if (facts.status().isStorageError()) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    "Party data could not be loaded.");
        }
        if (facts.status().isNoActiveParty()) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.NO_ACTIVE_PARTY,
                    null,
                    "No active party is available.");
        }
        List<Integer> activeLevels = facts.activePartyLevels();
        EncounterPlan plan = maybePlan.get();
        int totalBaseXp = totalBaseXp(plan.creatures());
        int creatureCount = plan.creatureCount();
        EncounterDifficultyMath.Thresholds thresholds = EncounterDifficultyMath.thresholdsFor(activeLevels);
        double multiplier = EncounterDifficultyTargets.multiplierFor(creatureCount, activeLevels.size());
        int adjustedXp = (int) Math.round(totalBaseXp * multiplier);
        return new EncounterPlanBudgetResult(
                EncounterPlanBudgetStatus.SUCCESS,
                new EncounterPlanBudgetSummary(
                        plan.id(),
                        plan.name(),
                        plan.generatedLabel(),
                        creatureCount,
                        totalBaseXp,
                        adjustedXp,
                        multiplier,
                        difficultyLabel(adjustedXp, thresholds)),
                "");
    }

    private int totalBaseXp(List<EncounterPlanCreature> creaturesInPlan) {
        int total = 0;
        for (EncounterPlanCreature creature : creaturesInPlan == null ? List.<EncounterPlanCreature>of() : creaturesInPlan) {
            CreatureDetailResult detailResult = creatures.loadCreatureDetail(new LoadCreatureDetailQuery(creature.creatureId()));
            if (detailResult.status() != CreatureLookupStatus.SUCCESS || detailResult.detail() == null) {
                throw new IllegalStateException("Creature detail could not be loaded for plan budget.");
            }
            total += detailResult.detail().xp() * creature.quantity();
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
}
