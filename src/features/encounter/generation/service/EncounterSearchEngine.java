package features.encounter.generation.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import features.creaturecatalog.model.Creature;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.gamerules.model.MonsterRole;
import features.encounter.rules.EncounterRules;

/**
 * Encounter generation from hard constraints + weighted random choices.
 */
final class EncounterSearchEngine {
    private EncounterSearchEngine() {
        throw new AssertionError("No instances");
    }

    static final int MAX_CREATURES_PER_SLOT = EncounterRules.MAX_CREATURES_PER_SLOT;

    private static final int MAX_DIFFERENT_CREATURES = 4;
    private static final int ATTEMPTS_PER_TOLERANCE = 120;
    private static final int START_TOLERANCE_PCT = 5;
    private static final int TOLERANCE_STEP_PCT = 1;

    static EncounterGenerator.GenerationResult generateEncounter(
            EncounterGenerator.EncounterRequest request, List<Creature> candidates) {
        return generateEncounter(request, candidates, GenerationContext.defaultContext());
    }

    static EncounterGenerator.GenerationResult generateEncounter(
            EncounterGenerator.EncounterRequest request,
            List<Creature> candidates,
            GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        long deadlineNanos = ctx.deadlineNanos();
        int partySize = Math.max(1, request.partySize());
        int avgLevel = Math.max(1, Math.min(20, request.avgLevel()));

        EncounterTuning.SlotBounds bounds = EncounterTuning.computeMonsterSlotBounds(partySize);
        if (candidates == null || candidates.isEmpty()) {
            return buildEmptyEncounterResult(request, avgLevel, partySize);
        }

        double maxAllowedCr = avgLevel + 1.0;
        List<Creature> pool = CandidateScorer.filterUsable(candidates,
                EncounterTuning.computeXpCeiling(avgLevel, request.difficultyValue(), partySize),
                maxAllowedCr);
        if (pool.isEmpty()) {
            return buildEmptyEncounterResult(request, avgLevel, partySize);
        }

        Map<Long, Creature> byId = new HashMap<>();
        Map<Long, MonsterRole> roleMap = new HashMap<>();
        Map<Long, MonsterRole> dynamicRoles = request.dynamicRolesByCreatureId() != null
                ? request.dynamicRolesByCreatureId()
                : Map.of();
        int globalMinXp = Integer.MAX_VALUE;
        int globalMaxXp = Integer.MIN_VALUE;
        for (Creature c : pool) {
            byId.put(c.Id, c);
            roleMap.put(c.Id, dynamicRoles.getOrDefault(c.Id, CandidateScorer.parseRole(c.Role)));
            globalMinXp = Math.min(globalMinXp, c.XP);
            globalMaxXp = Math.max(globalMaxXp, c.XP);
        }

        AutoConfigResolver.AutoConfig config = AutoConfigResolver.resolveAutoConfig(
                request, bounds, partySize, avgLevel, globalMinXp, globalMaxXp,
                MAX_DIFFERENT_CREATURES, deadlineNanos, ctx);
        if (config == null) {
            if (ctx.isExpired(deadlineNanos)) return EncounterGenerator.GenerationResult.timeout();
            if (!AutoConfigResolver.isStructurallyFeasible(
                    request.difficultyValue() < 0 ? null : Math.max(0.0, Math.min(1.0, request.difficultyValue())),
                    request.amountValue() < 0 ? null : Math.max(1.0, Math.min(5.0, request.amountValue())),
                    request.groupsLevel() < 0 ? null : Math.max(1, Math.min(5, request.groupsLevel())),
                    request.balanceLevel() < 0 ? null : Math.max(1, Math.min(5, request.balanceLevel())),
                    bounds, partySize, avgLevel, globalMinXp, globalMaxXp, MAX_DIFFERENT_CREATURES)) {
                return EncounterGenerator.GenerationResult.blockedByUserInput(
                        EncounterGenerator.GenerationFailureReason.SETTINGS_COMBINATION_INFEASIBLE);
            }
            return EncounterGenerator.GenerationResult.noSolution(
                    EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION);
        }

        double difficultyValue = config.difficultyValue();
        double amountValue = config.amountValue();
        int groupsLevel = config.groupsLevel();
        int balanceLevel = config.balanceLevel();

        int budget = EncounterTuning.mapDifficultyToBudget(avgLevel, partySize, difficultyValue);
        int targetSlots = EncounterTuning.targetSlotsForLevel(bounds, groupsLevel);
        int targetCreatures = EncounterTuning.targetCreaturesForAmount(amountValue, partySize);
        if (targetCreatures != Integer.MAX_VALUE) {
            targetCreatures = Math.max(targetSlots, targetCreatures);
        }

        if (targetCreatures != Integer.MAX_VALUE
                && (targetCreatures < targetSlots || targetCreatures > targetSlots * MAX_CREATURES_PER_SLOT)) {
            return request.amountValue() < 0 || request.groupsLevel() < 0
                    ? EncounterGenerator.GenerationResult.noSolution(
                    EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION)
                    : EncounterGenerator.GenerationResult.blockedByUserInput(
                    EncounterGenerator.GenerationFailureReason.AMOUNT_GROUPS_CONFLICT);
        }

        int maxTypes = Math.max(1, Math.min(MAX_DIFFERENT_CREATURES, targetSlots));
        List<ShapePlanner.ShapePlan> feasiblePlans = targetCreatures == Integer.MAX_VALUE
                ? List.of()
                : ShapePlanner.buildFeasibleShapePlans(targetSlots, targetCreatures, maxTypes);
        if (targetCreatures != Integer.MAX_VALUE && feasiblePlans.isEmpty()) {
            return request.amountValue() < 0 || request.groupsLevel() < 0
                    ? EncounterGenerator.GenerationResult.noSolution(
                    EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION)
                    : EncounterGenerator.GenerationResult.blockedByUserInput(
                    EncounterGenerator.GenerationFailureReason.SLOT_DISTRIBUTION_INVALID);
        }

        int tolPct = START_TOLERANCE_PCT;
        while (true) {
            if (ctx.isExpired(deadlineNanos)) return EncounterGenerator.GenerationResult.timeout();
            int lowerAdj = (int) Math.floor(budget * (1.0 - tolPct / 100.0));
            int upperAdj = (int) Math.ceil(budget * (1.0 + tolPct / 100.0));

            for (int attempt = 0; attempt < ATTEMPTS_PER_TOLERANCE; attempt++) {
                if (ctx.isExpired(deadlineNanos)) return EncounterGenerator.GenerationResult.timeout();
                List<Integer> slotPartition;
                List<Integer> counts;
                if (!feasiblePlans.isEmpty()) {
                    ShapePlanner.ShapePlan picked = feasiblePlans.get(ctx.nextInt(feasiblePlans.size()));
                    slotPartition = picked.slotPartition();
                    counts = picked.counts();
                } else {
                    int typeTarget = ctx.nextInt(1, maxTypes + 1);
                    slotPartition = ShapePlanner.partitionSlots(targetSlots, typeTarget, ctx);
                    if (slotPartition.isEmpty()) continue;
                    counts = ShapePlanner.pickCountsForPartition(slotPartition, amountValue, targetCreatures, ctx);
                    if (counts.isEmpty()) continue;
                }

                int totalCreatures = ShapePlanner.sumCounts(counts);
                if (totalCreatures <= 0) continue;
                if (targetCreatures != Integer.MAX_VALUE && totalCreatures != targetCreatures) continue;

                double mult = EncounterScoring.multiplierForGroupSize(totalCreatures);
                int rawLower = (int) Math.ceil(lowerAdj / mult);
                int rawUpper = (int) Math.floor(upperAdj / mult);
                if (rawLower > rawUpper) continue;

                int minRawAll = ShapePlanner.sumCounts(counts) * globalMinXp;
                int maxRawAll = ShapePlanner.sumCounts(counts) * globalMaxXp;
                if (maxRawAll < rawLower || minRawAll > rawUpper) continue;

                int typeTarget = slotPartition.size();
                List<Double> shares = ShapePlanner.sampleShares(typeTarget, balanceLevel, ctx);
                List<ShapePlanner.Block> blocks = new ArrayList<>();
                for (int i = 0; i < typeTarget; i++) {
                    blocks.add(new ShapePlanner.Block(slotPartition.get(i), counts.get(i), shares.get(i)));
                }
                blocks = ShapePlanner.sortBlocksForSearch(blocks);

                SearchBacktracker.BuildState state = SearchBacktracker.search(
                        blocks,
                        pool,
                        roleMap,
                        rawLower,
                        rawUpper,
                        globalMinXp,
                        globalMaxXp,
                        amountValue,
                        balanceLevel,
                        request.selectionWeights(),
                        deadlineNanos,
                        ctx);

                if (ctx.isExpired(deadlineNanos)) return EncounterGenerator.GenerationResult.timeout();
                if (state == null) continue;
                if (SearchBacktracker.mobSlotCount(state) != targetSlots) continue;
                if (state.counts.size() > MAX_DIFFERENT_CREATURES) continue;
                if (!SearchBacktracker.passesLowHighCrRule(state, byId)) continue;

                int adj = SearchBacktracker.adjustedXpFromState(state, byId);
                if (adj >= lowerAdj && adj <= upperAdj) {
                    List<EncounterSlot> slots = SearchBacktracker.toEncounterSlots(state, byId, roleMap);
                    String diff = EncounterScoring.classifyDifficultyFromSlots(slots, avgLevel, partySize);
                    return EncounterGenerator.GenerationResult.success(buildResult(slots, diff, avgLevel, partySize, budget));
                }
            }
            tolPct += TOLERANCE_STEP_PCT;
        }
    }

    private static Encounter buildResult(List<EncounterSlot> slots, String difficulty, int avgLevel,
                                         int partySize, int xpBudget) {
        return new Encounter(slots, difficulty, avgLevel, partySize, xpBudget, EncounterScoring.deriveShapeLabel(slots));
    }

    private static EncounterGenerator.GenerationResult buildEmptyEncounterResult(
            EncounterGenerator.EncounterRequest request,
            int avgLevel,
            int partySize) {
        double difficulty = request.difficultyValue() < 0
                ? 0.5
                : Math.max(0.0, Math.min(1.0, request.difficultyValue()));
        int fallbackBudget = EncounterTuning.mapDifficultyToBudget(avgLevel, partySize, difficulty);
        return EncounterGenerator.GenerationResult.success(buildResult(
                List.of(),
                EncounterScoring.classifyDifficultyByBudget(avgLevel, partySize, fallbackBudget),
                avgLevel,
                partySize,
                fallbackBudget));
    }
}
