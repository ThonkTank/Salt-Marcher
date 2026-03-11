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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Orchestrates encounter generation across candidate projection and search policies.
 *
 * <p>At runtime, returning a decent fallback encounter is preferable to reporting failure after
 * the search has already found something playable. Exact matches still win, but budget exhaustion
 * should degrade into the best discovered encounter rather than "no solution".
 */
public final class EncounterSearchEngine {
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
        EncounterGenerator.EncounterRequest normalizedRequest = EncounterGenerator.normalizeRequest(request);
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        long deadlineNanos = ctx.deadlineNanos();
        int partySize = normalizedRequest.partySize();
        int avgLevel = normalizedRequest.avgLevel();

        if (candidates == null || candidates.isEmpty()) {
            return EncounterResultAssembler.buildNoSolutionResult();
        }

        double maxAllowedCr = avgLevel + 3.0;
        List<Creature> pool = filterUsable(
                candidates,
                EncounterTuning.computeXpCeiling(avgLevel, normalizedRequest.difficultyBand(), partySize),
                maxAllowedCr);
        if (pool.isEmpty()) {
            return EncounterResultAssembler.buildNoSolutionResult();
        }

        EncounterPartyBenchmarks party = EncounterCalibrationService.partyBenchmarksForAverageLevel(avgLevel, partySize);
        EncounterBudgets budgets = EncounterBudgetPolicy.forRequest(normalizedRequest, avgLevel, partySize, party, ctx);

        EncounterGenerator.GenerationDataSnapshot analysisSnapshot = normalizedRequest.analysisSnapshot();
        Map<Long, CreatureRoleProfile> roleProfiles = analysisSnapshot.roleProfilesByCreatureId();
        Map<Long, Integer> selectionWeights = analysisSnapshot.selectionWeights();

        List<CandidateEntry> entries = EncounterCandidateProjector.buildCandidateEntries(pool, roleProfiles);
        if (entries.isEmpty()) {
            return EncounterResultAssembler.buildNoSolutionResult();
        }
        int candidatePoolSize = entries.size();

        SearchOutcome bestFallback = null;
        List<RelaxationProfile> relaxations = EncounterSearchRelaxationPolicy.orderedRelaxations();
        for (int relaxationStage = 0; relaxationStage < relaxations.size(); relaxationStage++) {
            RelaxationProfile relaxation = relaxations.get(relaxationStage);
            List<CandidateEntry> shortlistedEntries = shortlistEntries(entries, budgets, relaxation, selectionWeights, ctx);
            if (shortlistedEntries.isEmpty()) {
                continue;
            }
            for (int attempt = 0; attempt < EncounterSearchRelaxationPolicy.ATTEMPTS_PER_RELAXATION; attempt++) {
                if (ctx.isExpired(deadlineNanos)) {
                    return buildTimeoutOrFallback(bestFallback, budgets, avgLevel, partySize, candidatePoolSize);
                }
                SearchOutcome outcome = searchAttempt(
                        shortlistedEntries,
                        budgets,
                        relaxation,
                        selectionWeights,
                        ctx,
                        deadlineNanos,
                        candidatePoolSize,
                        relaxationStage);
                if (outcome == null || outcome.bestState() == null) {
                    continue;
                }
                if (outcome.exactMatch()) {
                    return buildSuccessResult(
                            outcome.bestState(),
                            budgets,
                            relaxation,
                            avgLevel,
                            partySize,
                            outcome);
                }
                bestFallback = betterOutcome(bestFallback, outcome, budgets);
            }
        }

        if (ctx.isExpired(deadlineNanos)) {
            return buildTimeoutOrFallback(bestFallback, budgets, avgLevel, partySize, candidatePoolSize);
        }
        if (bestFallback != null && bestFallback.bestState() != null) {
            return buildSuccessResult(
                    bestFallback.bestState(),
                    budgets,
                    bestFallback.relaxation(),
                    avgLevel,
                    partySize,
                    bestFallback);
        }
        return EncounterGenerator.GenerationResult.noSolution(
                EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION);
    }

    private static SearchOutcome searchAttempt(
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            Map<Long, Integer> selectionWeights,
            GenerationContext context,
            long deadlineNanos,
            int candidatePoolSize,
            int relaxationStage) {
        SearchState state = new SearchState();
        SearchOutcome best = null;
        List<DecisionPoint> history = new ArrayList<>();
        int iterations = 0;
        int candidateEvaluations = 0;
        int backtracks = 0;
        int workUnits = 0;

        while (true) {
            boolean timedOut = context.isExpired(deadlineNanos);
            boolean workBudgetExhausted = workUnits >= context.maxWorkUnits();
            if (timedOut || workBudgetExhausted) {
                return markSearchBudgetExhausted(best);
            }
            iterations++;
            if (EncounterConstraintPolicy.isComplete(state, budgets, relaxation)) {
                return new SearchOutcome(
                        true,
                        state,
                        relaxation,
                        candidatePoolSize,
                        iterations,
                        candidateEvaluations,
                        backtracks,
                        relaxationStage,
                        false);
            }
            if (!state.isEmpty()) {
                best = betterOutcome(
                        best,
                        new SearchOutcome(
                                false,
                                state,
                                relaxation,
                                candidatePoolSize,
                                iterations,
                                candidateEvaluations,
                                backtracks,
                                relaxationStage,
                                false),
                        budgets);
            }
            if (state.entries().size() >= budgets.distinctCreatureBudget().maxDistinctCreatures()) {
                if (!tryBacktrack(history, context)) {
                    return best;
                }
                backtracks++;
                state = advanceBacktrack(history, selectionWeights, context);
                continue;
            }

            List<CandidateChoice> options = EncounterChoicePolicy.buildChoices(
                    state,
                    entries,
                    budgets,
                    relaxation,
                    selectionWeights);
            candidateEvaluations += options.size();
            workUnits += Math.max(1, options.size());
            if (options.isEmpty()) {
                if (!tryBacktrack(history, context) || backtracks >= budgets.heuristics().maxBacktracksPerAttempt()) {
                    return best;
                }
                backtracks++;
                state = advanceBacktrack(history, selectionWeights, context);
                continue;
            }

            CandidateChoice chosen = pickRandomChoice(options, selectionWeights, context);
            List<CandidateChoice> alternatives = removeChosen(options, chosen);
            if (!alternatives.isEmpty()) {
                history.add(new DecisionPoint(state, alternatives));
            }
            state = chosen.nextState();
        }
    }

    private static List<CandidateEntry> shortlistEntries(
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            Map<Long, Integer> selectionWeights,
            GenerationContext context) {
        int shortlistLimit = budgets.heuristics().shortlistLimit();
        if (entries.size() <= shortlistLimit) {
            return entries;
        }
        SearchState empty = new SearchState();
        List<CandidateEntry> feasibleEntries = new ArrayList<>(entries.size());
        for (CandidateEntry entry : entries) {
            int selectionWeight = Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
            boolean feasible = false;
            for (EncounterChoicePolicy.AllowedCount allowedCount
                    : EncounterChoicePolicy.allowedCountsFor(entry, budgets, relaxation, empty, selectionWeight)) {
                SearchState next = allowedCount.nextState();
                if (!EncounterConstraintPolicy.evaluateState(next, budgets, relaxation).allowsGrowth()) {
                    continue;
                }
                feasible = true;
                break;
            }
            if (feasible) {
                feasibleEntries.add(entry);
            }
        }
        if (feasibleEntries.size() <= shortlistLimit) {
            return feasibleEntries;
        }
        return sampleEntriesWithoutReplacement(feasibleEntries, selectionWeights, shortlistLimit, context);
    }

    private static CandidateChoice pickRandomChoice(
            List<CandidateChoice> options,
            Map<Long, Integer> selectionWeights,
            GenerationContext context) {
        if (options.size() == 1) {
            return options.getFirst();
        }
        Map<Long, List<CandidateChoice>> byCreatureId = new java.util.LinkedHashMap<>();
        for (CandidateChoice option : options) {
            byCreatureId.computeIfAbsent(option.entry().creature().Id, ignored -> new ArrayList<>()).add(option);
        }
        List<Long> creatureIds = new ArrayList<>(byCreatureId.keySet());
        Long chosenCreatureId = pickWeightedCreatureId(creatureIds, selectionWeights, context);
        List<CandidateChoice> creatureOptions = byCreatureId.get(chosenCreatureId);
        return creatureOptions.get(context.nextInt(creatureOptions.size()));
    }

    private static List<CandidateChoice> removeChosen(List<CandidateChoice> options, CandidateChoice chosen) {
        if (options.size() <= 1) {
            return List.of();
        }
        List<CandidateChoice> alternatives = new ArrayList<>(options);
        alternatives.remove(chosen);
        return alternatives;
    }

    private static boolean tryBacktrack(List<DecisionPoint> history, GenerationContext context) {
        for (int i = history.size() - 1; i >= 0; i--) {
            if (!history.get(i).alternatives().isEmpty()) {
                return true;
            }
            history.remove(i);
        }
        return false;
    }

    private static SearchState advanceBacktrack(
            List<DecisionPoint> history,
            Map<Long, Integer> selectionWeights,
            GenerationContext context) {
        while (!history.isEmpty()) {
            DecisionPoint point = history.remove(history.size() - 1);
            if (point.alternatives().isEmpty()) {
                continue;
            }
            CandidateChoice next = pickRandomChoice(point.alternatives(), selectionWeights, context);
            List<CandidateChoice> remaining = removeChosen(point.alternatives(), next);
            if (!remaining.isEmpty()) {
                history.add(new DecisionPoint(point.state(), remaining));
            }
            return next.nextState();
        }
        return new SearchState();
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
        double candidateScore = EncounterConstraintPolicy.outcomeScore(
                candidate.bestState(),
                budgets,
                candidate.relaxation());
        double currentScore = EncounterConstraintPolicy.outcomeScore(
                currentBest.bestState(),
                budgets,
                currentBest.relaxation());
        return candidateScore >= currentScore ? candidate : currentBest;
    }

    private static EncounterGenerator.GenerationResult buildSuccessResult(
            SearchState result,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            int avgLevel,
            int partySize,
            SearchOutcome outcome) {
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
                EncounterResultAssembler.buildDiagnostics(
                        result,
                        budgets,
                        relaxation,
                        outcome.candidatePoolSize(),
                        outcome.iterations(),
                        outcome.candidateEvaluations(),
                        outcome.backtrackCount(),
                        outcome.relaxationStage(),
                        outcome.exactMatch(),
                        outcome.searchBudgetExhausted()));
    }

    private static EncounterGenerator.GenerationResult buildTimeoutOrFallback(
            SearchOutcome bestFallback,
            EncounterBudgets budgets,
            int avgLevel,
            int partySize,
            int candidatePoolSize) {
        if (bestFallback != null && bestFallback.bestState() != null) {
            return buildSuccessResult(
                    bestFallback.bestState(),
                    budgets,
                    bestFallback.relaxation(),
                    avgLevel,
                    partySize,
                    bestFallback);
        }
        return EncounterGenerator.GenerationResult.timeout();
    }

    private static SearchOutcome markSearchBudgetExhausted(SearchOutcome outcome) {
        if (outcome == null) {
            return null;
        }
        return new SearchOutcome(
                outcome.exactMatch(),
                outcome.bestState(),
                outcome.relaxation(),
                outcome.candidatePoolSize(),
                outcome.iterations(),
                outcome.candidateEvaluations(),
                outcome.backtrackCount(),
                outcome.relaxationStage(),
                true);
    }

    private record DecisionPoint(SearchState state, List<CandidateChoice> alternatives) {}
    private record SearchOutcome(
            boolean exactMatch,
            SearchState bestState,
            RelaxationProfile relaxation,
            int candidatePoolSize,
            int iterations,
            int candidateEvaluations,
            int backtrackCount,
            int relaxationStage,
            boolean searchBudgetExhausted
    ) {}

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

    private static List<CandidateEntry> sampleEntriesWithoutReplacement(
            List<CandidateEntry> entries,
            Map<Long, Integer> selectionWeights,
            int limit,
            GenerationContext context) {
        List<CandidateEntry> remaining = new ArrayList<>(entries);
        List<CandidateEntry> selected = new ArrayList<>(Math.min(limit, remaining.size()));
        while (!remaining.isEmpty() && selected.size() < limit) {
            CandidateEntry picked = pickWeightedEntry(remaining, selectionWeights, context);
            selected.add(picked);
            remaining.remove(picked);
        }
        return selected;
    }

    private static CandidateEntry pickWeightedEntry(
            List<CandidateEntry> entries,
            Map<Long, Integer> selectionWeights,
            GenerationContext context) {
        if (entries.size() == 1) {
            return entries.getFirst();
        }
        double totalWeight = 0.0;
        for (CandidateEntry entry : entries) {
            totalWeight += Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
        }
        double pick = context.nextDouble() * totalWeight;
        double cursor = 0.0;
        for (CandidateEntry entry : entries) {
            cursor += Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
            if (pick <= cursor) {
                return entry;
            }
        }
        return entries.getLast();
    }

    private static Long pickWeightedCreatureId(
            List<Long> creatureIds,
            Map<Long, Integer> selectionWeights,
            GenerationContext context) {
        if (creatureIds.size() == 1) {
            return creatureIds.getFirst();
        }
        double totalWeight = 0.0;
        for (Long creatureId : creatureIds) {
            totalWeight += Math.max(1, selectionWeights.getOrDefault(creatureId, 1));
        }
        double pick = context.nextDouble() * totalWeight;
        double cursor = 0.0;
        for (Long creatureId : creatureIds) {
            cursor += Math.max(1, selectionWeights.getOrDefault(creatureId, 1));
            if (pick <= cursor) {
                return creatureId;
            }
        }
        return creatureIds.getLast();
    }
}
