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

        for (RelaxationProfile relaxation : EncounterSearchRelaxationPolicy.orderedRelaxations()) {
            for (int attempt = 0; attempt < EncounterSearchRelaxationPolicy.ATTEMPTS_PER_RELAXATION; attempt++) {
                if (ctx.isExpired(deadlineNanos)) {
                    return EncounterGenerator.GenerationResult.timeout();
                }
                SearchState result = search(
                        new SearchState(),
                        entries,
                        budgets,
                        relaxation,
                        selectionWeights,
                        ctx,
                        deadlineNanos);
                if (result == null) {
                    continue;
                }
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
        }

        if (ctx.isExpired(deadlineNanos)) {
            return EncounterGenerator.GenerationResult.timeout();
        }
        return EncounterGenerator.GenerationResult.noSolution(
                EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION);
    }

    private static SearchState search(
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
            return state;
        }
        if (state.entries().size() >= EncounterConstraintPolicy.MAX_DIFFERENT_CREATURES) {
            return null;
        }

        List<CandidateChoice> options = EncounterChoicePolicy.buildChoices(
                state,
                entries,
                budgets,
                relaxation,
                selectionWeights);
        if (options.isEmpty()) {
            return null;
        }
        options = prioritizeOptions(options, context);
        if (options.size() > EncounterChoicePolicy.MAX_BRANCHES_PER_DEPTH) {
            options = new ArrayList<>(options.subList(0, EncounterChoicePolicy.MAX_BRANCHES_PER_DEPTH));
        }

        for (CandidateChoice option : options) {
            SearchState next = option.nextState();
            SearchState result = search(next, entries, budgets, relaxation, selectionWeights, context, deadlineNanos);
            if (result != null) {
                return result;
            }
        }
        return null;
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

    private record RankedChoice(CandidateChoice choice, double priority) {}

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
