package features.encounter.generation.service.search;

import features.creatures.model.Creature;
import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.EncounterTuning;
import features.encounter.generation.service.GenerationContext;
import features.encounter.generation.service.search.model.CandidateChoice;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchExecutionDebugMetadata;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.generation.service.search.model.SearchStopReason;
import features.encounter.generation.service.search.policy.EncounterBudgetPolicy;
import features.encounter.generation.service.search.policy.EncounterChoicePolicy;
import features.encounter.generation.service.search.policy.EncounterConstraintPolicy;
import features.encounter.generation.service.search.policy.EncounterSearchRelaxationPolicy;
import features.encounter.generation.service.search.policy.EncounterSearchScoringPolicy;
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
 *
 * <p>This class coordinates the search only. Result construction lives in
 * {@link EncounterResultAssembler}.
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
        EncounterGenerator.EncounterRequest normalizedRequest = java.util.Objects.requireNonNull(request, "request");
        GenerationContext ctx = contextOrDefault(context);
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

        SearchTermination bestFallback = null;
        List<RelaxationProfile> relaxations = EncounterSearchRelaxationPolicy.orderedRelaxations();
        for (int relaxationStage = 0; relaxationStage < relaxations.size(); relaxationStage++) {
            RelaxationProfile relaxation = relaxations.get(relaxationStage);
            List<CandidateEntry> shortlistedEntries = shortlistEntries(entries, budgets, relaxation, selectionWeights, ctx);
            if (shortlistedEntries.isEmpty()) {
                continue;
            }

            SearchTermination seedTermination = SearchAttemptRunner.runSeedPass(
                    shortlistedEntries,
                    budgets,
                    relaxation,
                    selectionWeights,
                    ctx,
                    new SearchExecutionBudget(seedWorkBudget(budgets, ctx), deadlineNanos),
                    candidatePoolSize,
                    relaxationStage);
            bestFallback = betterTermination(bestFallback, seedTermination, budgets);
            if (seedTermination != null && seedTermination.isExactMatch()) {
                return buildSuccessResult(seedTermination, budgets, avgLevel, partySize);
            }
            if (hasExternalStop(ctx, deadlineNanos)) {
                return buildTimeoutOrFallback(
                        withStopReason(bestFallback, resolveExternalStopReason(ctx, deadlineNanos)),
                        budgets,
                        avgLevel,
                        partySize);
            }

            for (int attempt = 0; attempt < EncounterSearchRelaxationPolicy.ATTEMPTS_PER_RELAXATION; attempt++) {
                if (hasExternalStop(ctx, deadlineNanos)) {
                    return buildTimeoutOrFallback(
                            withStopReason(bestFallback, resolveExternalStopReason(ctx, deadlineNanos)),
                            budgets,
                            avgLevel,
                            partySize);
                }
                SearchTermination attemptTermination = SearchAttemptRunner.runStochasticPass(
                        shortlistedEntries,
                        budgets,
                        relaxation,
                        selectionWeights,
                        ctx,
                        new SearchExecutionBudget(ctx.maxWorkUnits(), deadlineNanos),
                        candidatePoolSize,
                        relaxationStage,
                        budgets.heuristics().maxBacktracksPerAttempt());
                bestFallback = betterTermination(bestFallback, attemptTermination, budgets);
                if (attemptTermination != null && attemptTermination.isExactMatch()) {
                    return buildSuccessResult(attemptTermination, budgets, avgLevel, partySize);
                }
            }
        }

        if (hasExternalStop(ctx, deadlineNanos)) {
            return buildTimeoutOrFallback(
                    withStopReason(bestFallback, resolveExternalStopReason(ctx, deadlineNanos)),
                    budgets,
                    avgLevel,
                    partySize);
        }
        if (bestFallback != null && bestFallback.bestState() != null) {
            return buildSuccessResult(bestFallback, budgets, avgLevel, partySize);
        }
        return EncounterResultAssembler.buildNoSolutionResult();
    }

    private static int seedWorkBudget(EncounterBudgets budgets, GenerationContext context) {
        int sharePercent = Math.max(1, budgets.heuristics().seedWorkBudgetSharePercent());
        return Math.max(1, (context.maxWorkUnits() * sharePercent) / 100);
    }

    private static EncounterGenerator.GenerationResult buildSuccessResult(
            SearchTermination termination,
            EncounterBudgets budgets,
            int avgLevel,
            int partySize) {
        return EncounterResultAssembler.buildSuccessResult(termination, budgets, avgLevel, partySize);
    }

    private static EncounterGenerator.GenerationResult buildTimeoutOrFallback(
            SearchTermination termination,
            EncounterBudgets budgets,
            int avgLevel,
            int partySize) {
        return EncounterResultAssembler.buildTimeoutOrFallback(termination, budgets, avgLevel, partySize);
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
            for (CandidateChoice choice
                    : EncounterChoicePolicy.buildChoicesForEntry(entry, empty, budgets, relaxation, selectionWeight)) {
                SearchState next = choice.nextState();
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

    private static CandidateChoice chooseNextChoice(
            List<CandidateChoice> options,
            Map<Long, Integer> selectionWeights,
            GenerationContext context,
            SearchMode mode) {
        return mode == SearchMode.SEED_GREEDY
                ? options.getFirst()
                : pickRandomChoice(options, selectionWeights, context);
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

    private static boolean tryBacktrack(List<DecisionPoint> history) {
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

    private static SearchTermination betterTermination(
            SearchTermination currentBest,
            SearchTermination candidate,
            EncounterBudgets budgets) {
        if (candidate == null || candidate.bestState() == null) {
            return currentBest;
        }
        if (currentBest == null || currentBest.bestState() == null) {
            return candidate;
        }
        double candidateScore = EncounterSearchScoringPolicy.outcomeScore(
                candidate.bestState(),
                budgets,
                candidate.relaxation());
        double currentScore = EncounterSearchScoringPolicy.outcomeScore(
                currentBest.bestState(),
                budgets,
                currentBest.relaxation());
        return candidateScore >= currentScore ? candidate : currentBest;
    }

    private static SearchTermination withStopReason(SearchTermination termination, SearchStopReason stopReason) {
        return termination == null ? null : termination.withStopReason(stopReason);
    }

    private static boolean hasExternalStop(GenerationContext context, long deadlineNanos) {
        return context.isCancelled() || context.isExpired(deadlineNanos);
    }

    private static SearchStopReason resolveExternalStopReason(
            GenerationContext context,
            long deadlineNanos) {
        if (context.isCancelled()) {
            return SearchStopReason.CANCELLED;
        }
        if (context.isExpired(deadlineNanos)) {
            return SearchStopReason.DEADLINE_EXHAUSTED;
        }
        return SearchStopReason.SEARCH_SPACE_EXHAUSTED;
    }

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

    private static GenerationContext contextOrDefault(GenerationContext context) {
        return context != null ? context : GenerationContext.defaultContext();
    }

    private record SearchExecutionBudget(int maxWorkUnits, long deadlineNanos) {}

    private enum SearchMode {
        SEED_GREEDY,
        STOCHASTIC_BACKTRACKING
    }

    private record DecisionPoint(SearchState state, List<CandidateChoice> alternatives) {}

    private static final class SearchAttemptRunner {
        private final List<CandidateEntry> entries;
        private final EncounterBudgets budgets;
        private final RelaxationProfile relaxation;
        private final Map<Long, Integer> selectionWeights;
        private final GenerationContext context;
        private final SearchExecutionBudget budget;
        private final int candidatePoolSize;
        private final int relaxationStage;
        private final SearchMode mode;
        private final int maxBacktracks;

        private SearchAttemptRunner(
                List<CandidateEntry> entries,
                EncounterBudgets budgets,
                RelaxationProfile relaxation,
                Map<Long, Integer> selectionWeights,
                GenerationContext context,
                SearchExecutionBudget budget,
                int candidatePoolSize,
                int relaxationStage,
                SearchMode mode,
                int maxBacktracks) {
            this.entries = entries;
            this.budgets = budgets;
            this.relaxation = relaxation;
            this.selectionWeights = selectionWeights;
            this.context = context;
            this.budget = budget;
            this.candidatePoolSize = candidatePoolSize;
            this.relaxationStage = relaxationStage;
            this.mode = mode;
            this.maxBacktracks = maxBacktracks;
        }

        private static SearchTermination runSeedPass(
                List<CandidateEntry> entries,
                EncounterBudgets budgets,
                RelaxationProfile relaxation,
                Map<Long, Integer> selectionWeights,
                GenerationContext context,
                SearchExecutionBudget budget,
                int candidatePoolSize,
                int relaxationStage) {
            return new SearchAttemptRunner(
                    entries,
                    budgets,
                    relaxation,
                    selectionWeights,
                    context,
                    budget,
                    candidatePoolSize,
                    relaxationStage,
                    SearchMode.SEED_GREEDY,
                    0).run();
        }

        private static SearchTermination runStochasticPass(
                List<CandidateEntry> entries,
                EncounterBudgets budgets,
                RelaxationProfile relaxation,
                Map<Long, Integer> selectionWeights,
                GenerationContext context,
                SearchExecutionBudget budget,
                int candidatePoolSize,
                int relaxationStage,
                int maxBacktracks) {
            return new SearchAttemptRunner(
                    entries,
                    budgets,
                    relaxation,
                    selectionWeights,
                    context,
                    budget,
                    candidatePoolSize,
                    relaxationStage,
                    SearchMode.STOCHASTIC_BACKTRACKING,
                    maxBacktracks).run();
        }

        private SearchTermination run() {
            SearchSession session = new SearchSession(
                    budgets,
                    relaxation,
                    candidatePoolSize,
                    relaxationStage,
                    budget,
                    mode,
                    maxBacktracks);
            while (true) {
                if (context.isCancelled()) {
                    return session.terminate(SearchStopReason.CANCELLED);
                }
                if (context.isExpired(budget.deadlineNanos())) {
                    return session.terminate(SearchStopReason.DEADLINE_EXHAUSTED);
                }
                if (session.isWorkBudgetExhausted()) {
                    return session.terminate(SearchStopReason.WORK_BUDGET_EXHAUSTED);
                }
                session.incrementIterations();
                if (EncounterConstraintPolicy.isComplete(session.currentState(), budgets, relaxation)) {
                    return session.terminate(SearchStopReason.EXACT_MATCH, session.currentState());
                }
                if (session.atDistinctCreatureLimit()) {
                    SearchState next = handleDeadEndOrBacktrack(session);
                    if (next == null) {
                        return session.terminate(SearchStopReason.SEARCH_SPACE_EXHAUSTED);
                    }
                    session.recordBacktrack(next);
                    continue;
                }

                List<CandidateChoice> options = EncounterChoicePolicy.buildChoices(
                        session.currentState(),
                        entries,
                        budgets,
                        relaxation,
                        selectionWeights);
                session.recordEvaluatedChoices(options.size());
                if (options.isEmpty()) {
                    SearchState next = handleDeadEndOrBacktrack(session);
                    if (next == null) {
                        return session.terminate(SearchStopReason.SEARCH_SPACE_EXHAUSTED);
                    }
                    session.recordBacktrack(next);
                    continue;
                }

                CandidateChoice chosen = chooseNextChoice(options, selectionWeights, context, mode);
                if (mode == SearchMode.STOCHASTIC_BACKTRACKING) {
                    List<CandidateChoice> alternatives = removeChosen(options, chosen);
                    if (!alternatives.isEmpty()) {
                        session.rememberAlternatives(new DecisionPoint(session.currentState(), alternatives));
                    }
                }
                session.recordTransition(chosen.nextState());
            }
        }

        private SearchState handleDeadEndOrBacktrack(SearchSession session) {
            if (mode == SearchMode.SEED_GREEDY
                    || !tryBacktrack(session.history())
                    || session.backtracks() >= maxBacktracks) {
                return null;
            }
            return advanceBacktrack(session.history(), selectionWeights, context);
        }
    }

    private static final class SearchSession {
        private final EncounterBudgets budgets;
        private final RelaxationProfile relaxation;
        private final int candidatePoolSize;
        private final int relaxationStage;
        private final SearchExecutionBudget budget;
        private final SearchMode mode;
        private final List<DecisionPoint> history = new ArrayList<>();
        private SearchState currentState = new SearchState();
        private SearchState bestState;
        private int iterations;
        private int candidateEvaluations;
        private int backtracks;
        private int workUnits;

        private SearchSession(
                EncounterBudgets budgets,
                RelaxationProfile relaxation,
                int candidatePoolSize,
                int relaxationStage,
                SearchExecutionBudget budget,
                SearchMode mode,
                int maxBacktracks) {
            this.budgets = budgets;
            this.relaxation = relaxation;
            this.candidatePoolSize = candidatePoolSize;
            this.relaxationStage = relaxationStage;
            this.budget = budget;
            this.mode = mode;
        }

        private SearchState currentState() {
            return currentState;
        }

        private List<DecisionPoint> history() {
            return history;
        }

        private int backtracks() {
            return backtracks;
        }

        private void incrementIterations() {
            iterations++;
        }

        private boolean isWorkBudgetExhausted() {
            return workUnits >= budget.maxWorkUnits();
        }

        private boolean atDistinctCreatureLimit() {
            return currentState.entries().size() >= budgets.distinctCreatureBudget().maxDistinctCreatures();
        }

        private void rememberAlternatives(DecisionPoint decisionPoint) {
            history.add(decisionPoint);
        }

        private void recordEvaluatedChoices(int count) {
            candidateEvaluations += count;
            workUnits += Math.max(1, count);
        }

        private void recordTransition(SearchState nextState) {
            currentState = nextState;
            considerCandidate(nextState);
        }

        private void recordBacktrack(SearchState nextState) {
            backtracks++;
            currentState = nextState;
            considerCandidate(nextState);
        }

        private void considerCandidate(SearchState candidateState) {
            if (candidateState == null || candidateState.isEmpty()) {
                return;
            }
            if (bestState == null) {
                bestState = candidateState;
                return;
            }
            double candidateScore = EncounterSearchScoringPolicy.outcomeScore(candidateState, budgets, relaxation);
            double currentScore = EncounterSearchScoringPolicy.outcomeScore(bestState, budgets, relaxation);
            if (candidateScore >= currentScore) {
                bestState = candidateState;
            }
        }

        private SearchTermination terminate(SearchStopReason stopReason) {
            return terminate(stopReason, bestState);
        }

        private SearchTermination terminate(SearchStopReason stopReason, SearchState terminalState) {
            if (terminalState != null && !terminalState.isEmpty()) {
                considerCandidate(terminalState);
            }
            SearchState resolvedBest = terminalState != null && !terminalState.isEmpty() ? terminalState : bestState;
            return new SearchTermination(
                    resolvedBest,
                    relaxation,
                    new SearchExecutionDebugMetadata(
                            candidatePoolSize,
                            iterations,
                            candidateEvaluations,
                            backtracks,
                            relaxationStage,
                            stopReason,
                            mode == SearchMode.SEED_GREEDY && resolvedBest != null && !resolvedBest.isEmpty()));
        }
    }
}
