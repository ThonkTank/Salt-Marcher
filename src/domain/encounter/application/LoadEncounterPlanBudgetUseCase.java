package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.policy.EncounterDifficultyTargets;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;

public final class LoadEncounterPlanBudgetUseCase {

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

    public Result execute(long planId) {
        if (planId <= 0L) {
            return Result.invalidRequest("Encounter plan id must be positive.");
        }
        Optional<EncounterPlan> maybePlan = plans.load(planId);
        if (maybePlan.isEmpty()) {
            return Result.notFound("Encounter plan was not found.");
        }
        EncounterPartyFactsRepository.PartyBudgetFacts facts = party.loadPartyBudgetFacts();
        if (facts.status() == EncounterPartyFactsRepository.Status.STORAGE_ERROR) {
            return Result.storageError("Party data could not be loaded.");
        }
        if (facts.status() == EncounterPartyFactsRepository.Status.NO_ACTIVE_PARTY) {
            return Result.noActiveParty("No active party is available.");
        }
        List<Integer> activeLevels = facts.activePartyLevels();
        EncounterPlan plan = maybePlan.get();
        int totalBaseXp = totalBaseXp(plan.creatures());
        int creatureCount = plan.creatureCount();
        EncounterDifficultyMath.Thresholds thresholds = EncounterDifficultyMath.thresholdsFor(activeLevels);
        double multiplier = EncounterDifficultyTargets.multiplierFor(creatureCount, activeLevels.size());
        int adjustedXp = (int) Math.round(totalBaseXp * multiplier);
        return Result.success(new Summary(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                List.copyOf(activeLevels),
                facts.averageLevel(),
                thresholds.easy(),
                thresholds.medium(),
                thresholds.hard(),
                thresholds.deadly(),
                creatureCount,
                totalBaseXp,
                adjustedXp,
                multiplier,
                difficultyLabel(adjustedXp, thresholds)));
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

    public record Summary(
            long planId,
            String name,
            String generatedLabel,
            List<Integer> partyLevels,
            int averageLevel,
            int easyXp,
            int mediumXp,
            int hardXp,
            int deadlyXp,
            int creatureCount,
            int totalBaseXp,
            int adjustedXp,
            double xpMultiplier,
            String difficultyLabel
    ) {

        public Summary {
            partyLevels = partyLevels == null ? List.of() : List.copyOf(partyLevels);
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel;
        }
    }

    public record Result(
            Status status,
            @Nullable Summary summary,
            String message
    ) {

        static Result success(Summary summary) {
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
}
