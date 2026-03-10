package features.encounter.generation.service.search;

import features.creatures.model.Creature;
import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.EncounterScoring;
import features.encounter.generation.service.EncounterTuning;
import features.encounter.generation.service.GenerationContext;
import features.encounter.generation.service.search.model.CandidateChoice;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.generation.service.search.policy.EncounterBudgetPolicy;
import features.encounter.generation.service.search.policy.EncounterChoicePolicy;
import features.encounter.generation.service.search.policy.EncounterConstraintPolicy;
import features.encounter.generation.service.search.policy.EncounterSearchRelaxationPolicy;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.partyanalysis.model.CreatureRoleProfile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Orchestrates encounter generation across candidate projection and search policies.
 */
public final class EncounterSearchEngine {
    private static final double MIN_RANDOMIZED_BRANCH_WEIGHT = 1.0e-9;

    private EncounterSearchEngine() {
        throw new AssertionError("No instances");
    }

    public static EncounterGenerator.GenerationResult generateEncounter(
            EncounterGenerator.EncounterRequest request,
            List<Creature> candidates) {
        return generateEncounter(request, candidates, GenerationContext.defaultContext());
    }

    public static EncounterGenerator.GenerationResult generateEncounter(
            EncounterGenerator.EncounterRequest request,
            List<Creature> candidates,
            GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        long deadlineNanos = ctx.deadlineNanos();
        int partySize = Math.max(1, request.partySize());
        int avgLevel = Math.max(1, Math.min(20, request.avgLevel()));

        if (candidates == null || candidates.isEmpty()) {
            return EncounterResultAssembler.buildNoSolutionResult();
        }

        double maxAllowedCr = avgLevel + 3.0;
        List<Creature> pool = filterUsable(
                candidates,
                EncounterTuning.computeXpCeiling(avgLevel, request.difficultyBand(), partySize),
                maxAllowedCr);
        if (pool.isEmpty()) {
            return EncounterResultAssembler.buildNoSolutionResult();
        }

        EncounterPartyBenchmarks party = EncounterCalibrationService.partyBenchmarksForAverageLevel(avgLevel, partySize);
        EncounterBudgets budgets = EncounterBudgetPolicy.forRequest(request, avgLevel, partySize, party, ctx);

        EncounterGenerator.GenerationDataSnapshot analysisSnapshot = request.analysisSnapshot();
        Map<Long, CreatureRoleProfile> roleProfiles = analysisSnapshot.roleProfilesByCreatureId();
        Map<Long, Integer> selectionWeights = analysisSnapshot.selectionWeights();

        List<CandidateEntry> entries = EncounterCandidateProjector.buildCandidateEntries(
                pool,
                roleProfiles,
                party);
        if (entries.isEmpty()) {
            return EncounterResultAssembler.buildNoSolutionResult();
        }

        SearchOutcome bestFallback = null;
        for (RelaxationProfile relaxation : EncounterSearchRelaxationPolicy.orderedRelaxations()) {
            for (int attempt = 0; attempt < EncounterSearchRelaxationPolicy.ATTEMPTS_PER_RELAXATION; attempt++) {
                if (ctx.isExpired(deadlineNanos)) {
                    return EncounterGenerator.GenerationResult.timeout();
                }
                SearchOutcome outcome = search(
                        new SearchState(),
                        entries,
                        budgets,
                        relaxation,
                        selectionWeights,
                        ctx,
                        deadlineNanos);
                if (outcome == null || outcome.bestState() == null) {
                    continue;
                }
                if (outcome.exactMatch()) {
                    return buildSuccessResult(outcome.bestState(), budgets, relaxation, avgLevel, partySize);
                }
                bestFallback = betterOutcome(bestFallback, outcome, budgets);
            }
        }

        if (ctx.isExpired(deadlineNanos)) {
            return EncounterGenerator.GenerationResult.timeout();
        }
        if (bestFallback != null && bestFallback.bestState() != null) {
            return buildSuccessResult(
                    bestFallback.bestState(),
                    budgets,
                    bestFallback.relaxation(),
                    avgLevel,
                    partySize);
        }
        return EncounterGenerator.GenerationResult.noSolution(
                EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION);
    }

    private static SearchOutcome search(
            SearchState state,
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            Map<Long, Integer> selectionWeights,
            GenerationContext context,
            long deadlineNanos) {
        if (context.isExpired(deadlineNanos)) {
            return null;
        }
        if (EncounterConstraintPolicy.isComplete(state, budgets, relaxation)) {
            return new SearchOutcome(true, state, relaxation);
        }
        SearchOutcome best = EncounterConstraintPolicy.isViableFallback(state, budgets, relaxation)
                ? new SearchOutcome(false, state, relaxation)
                : null;
        if (state.entries().size() >= EncounterConstraintPolicy.MAX_DIFFERENT_CREATURES) {
            return best;
        }

        List<CandidateChoice> options = EncounterChoicePolicy.buildChoices(
                state,
                entries,
                budgets,
                relaxation,
                selectionWeights);
        if (options.isEmpty()) {
            return best;
        }
        options = prioritizeOptions(options, context);
        if (options.size() > EncounterChoicePolicy.MAX_BRANCHES_PER_DEPTH) {
            options = new ArrayList<>(options.subList(0, EncounterChoicePolicy.MAX_BRANCHES_PER_DEPTH));
        }

        for (CandidateChoice option : options) {
            SearchState next = option.nextState();
            SearchOutcome outcome = search(next, entries, budgets, relaxation, selectionWeights, context, deadlineNanos);
            if (outcome == null) {
                continue;
            }
            if (outcome.exactMatch()) {
                return outcome;
            }
            best = betterOutcome(best, outcome, budgets);
        }
        return best;
    }

    private static List<CandidateChoice> prioritizeOptions(
            List<CandidateChoice> options,
            GenerationContext context) {
        List<RankedChoice> ranked = new ArrayList<>(options.size());
        for (CandidateChoice option : options) {
            ranked.add(new RankedChoice(option, randomizedBranchPriority(option.score(), context)));
        }
        ranked.sort(Comparator
                .comparingDouble(RankedChoice::priority)
                .thenComparing((left, right) -> Double.compare(right.choice().score(), left.choice().score())));

        List<CandidateChoice> prioritized = new ArrayList<>(ranked.size());
        for (RankedChoice choice : ranked) {
            prioritized.add(choice.choice());
        }
        return prioritized;
    }

    private static double randomizedBranchPriority(double score, GenerationContext context) {
        double weight = Math.max(score, MIN_RANDOMIZED_BRANCH_WEIGHT);
        double sample = Math.max(context.nextDouble(), Double.MIN_VALUE);
        return -Math.log(sample) / weight;
    }

    private static SearchOutcome betterOutcome(
            SearchOutcome currentBest,
            SearchOutcome candidate,
            EncounterBudgets budgets) {
        if (candidate == null || candidate.bestState() == null) {
            return currentBest;
        }
        if (currentBest == null || currentBest.bestState() == null) {
            return candidate;
        }
        double candidateScore = EncounterChoicePolicy.scoreState(candidate.bestState(), budgets, candidate.relaxation());
        double currentScore = EncounterChoicePolicy.scoreState(currentBest.bestState(), budgets, currentBest.relaxation());
        return candidateScore > currentScore ? candidate : currentBest;
    }

    private static EncounterGenerator.GenerationResult buildSuccessResult(
            SearchState result,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            int avgLevel,
            int partySize) {
        List<EncounterSlot> slots = EncounterResultAssembler.toEncounterSlots(result);
        Encounter encounter = new Encounter(
                slots,
                EncounterScoring.classifyDifficultyFromSlots(slots, avgLevel, partySize),
                avgLevel,
                partySize,
                budgets.upperAdjustedXp(),
                EncounterScoring.deriveShapeLabel(slots));
        return EncounterGenerator.GenerationResult.success(
                encounter,
                null,
                EncounterResultAssembler.buildDiagnostics(result, budgets, relaxation));
    }

    private record RankedChoice(CandidateChoice choice, double priority) {}
    private record SearchOutcome(boolean exactMatch, SearchState bestState, RelaxationProfile relaxation) {}

    static List<Creature> filterUsable(List<Creature> candidates, int xpCeiling, double maxAllowedCr) {
        List<Creature> usable = new ArrayList<>();
        Set<Long> seenIds = new HashSet<>();
        for (Creature candidate : candidates) {
            if (candidate == null || candidate.Id == null) {
                continue;
            }
            if (!seenIds.add(candidate.Id)) {
                continue;
            }
            if (candidate.XP <= 0 || candidate.XP > xpCeiling) {
                continue;
            }
            if (candidate.CR != null && candidate.CR.numeric > maxAllowedCr) {
                continue;
            }
            usable.add(candidate);
        }
        return usable;
    }
}
