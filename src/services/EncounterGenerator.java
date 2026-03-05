package services;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Predicate;

import entities.Combatant;
import entities.MonsterCombatant;
import entities.Creature;
import services.EncounterTemplate.ShapeResult;
import services.EncounterTemplate.SlotSpec;
import services.RoleClassifier.MonsterRole;

/**
 * Generates balanced D&D 5e encounters using the XP budget model (DMG pp.82-83).
 *
 * <p><b>XP budget model:</b> Each party member has a per-difficulty XP threshold
 * (see {@link XpCalculator}). The encounter's "adjusted XP" is the sum of monster XP values
 * multiplied by a group-size multiplier ({@link #getMultiplierForGroupSize}) that accounts for
 * the tactical advantage of facing many monsters at once. The algorithm fills slot specs
 * from {@link EncounterTemplate} to hit the party's combined XP threshold for the target difficulty.
 */
public class EncounterGenerator {

    public static final int MAX_CREATURES_PER_SLOT = 10;

    /**
     * Parameters for encounter generation.
     * @param partySize       number of player characters
     * @param avgLevel        average party level (1-20)
     * @param creatureTypes   type filter (e.g. "Undead"); null or empty = no filter
     * @param subtypes        subtype filter; null or empty = no filter
     * @param biomes          biome filter; null or empty = no filter
     * @param difficultyValue 0.0 (Easy) to 1.0 (Deadly), or any negative value to randomise
     * @param groupCount      1-4 distinct creature groups, or any negative value to randomise
     * @param balance         0.0 (one dominant group) to 1.0 (all equal), or any negative value to randomise
     * @param strength        0.0 (many weak) to 1.0 (few elite), or any negative value to randomise
     */
    public record EncounterRequest(
        int partySize, int avgLevel,
        List<String> creatureTypes, List<String> subtypes, List<String> biomes,
        double difficultyValue, int groupCount, double balance, double strength
    ) {}

    /**
     * Computes the XP ceiling for candidate pre-fetching. When difficultyValue is negative
     * (auto-mode), uses the Deadly ceiling so the caller can fetch candidates that cover all
     * possible difficulty outcomes.
     */
    public static int computeXpCeiling(int avgLevel, double difficultyValue, int partySize) {
        double d = difficultyValue < 0 ? 1.0 : Math.max(0.0, Math.min(1.0, difficultyValue));
        int xpBudget = XpCalculator.interpolateThreshold(avgLevel, d) * partySize;
        double ceilingT = Math.min(d + 0.25, 1.0);
        int xpCeiling = XpCalculator.interpolateThreshold(avgLevel, ceilingT) * partySize;
        if (d > 0.85) xpCeiling = Math.max(xpCeiling, (int) (xpBudget * 1.4));
        return xpCeiling;
    }

    /**
     * @param request    contains partySize, avgLevel, creatureTypes, subtypes, biomes,
     *                   difficultyValue (-1 = auto), groupCount, balance, strength
     * @param candidates pre-fetched creature pool (caller fetches via CreatureService using
     *                   {@link #computeXpCeiling} to determine the appropriate XP cap)
     */
    public static Encounter generateEncounter(EncounterRequest request, List<Creature> candidates) {
        double difficultyValue = request.difficultyValue();
        int partySize = request.partySize();
        int avgLevel = request.avgLevel();
        int groupCount = request.groupCount();
        double balance = request.balance();
        double strength = request.strength();

        // 1. Resolve difficulty (randomize if auto)
        if (difficultyValue < 0) {
            double r = ThreadLocalRandom.current().nextDouble();
            if (r < 0.15)      difficultyValue = 0.0;
            else if (r < 0.55) difficultyValue = 0.333;
            else if (r < 0.90) difficultyValue = 0.667;
            else               difficultyValue = 1.0;
        }
        difficultyValue = Math.max(0.0, Math.min(1.0, difficultyValue));
        String difficultyName = XpCalculator.classifyDifficulty(difficultyValue);

        // 2. XP budget: interpolated between the 4 DMG threshold columns
        int xpBudget = XpCalculator.interpolateThreshold(avgLevel, difficultyValue) * partySize;
        // XP ceiling: allow up to 0.25 difficulty-units above target (e.g. Medium budget can use
        // Hard-tier creatures if needed), so the generator has room to find a viable match.
        double ceilingT = Math.min(difficultyValue + 0.25, 1.0);
        int xpCeiling = XpCalculator.interpolateThreshold(avgLevel, ceilingT) * partySize;
        // Deadly encounters (>0.85) need extra headroom because the XP interpolation saturates
        // at t=1.0 — grant 40% overshoot so ultra-high-CR creatures qualify.
        if (difficultyValue > 0.85) {
            xpCeiling = Math.max(xpCeiling, (int) (xpBudget * 1.4));
        }

        // 3. Generate shape dynamically
        ShapeResult shape = EncounterTemplate.generateShape(difficultyName, groupCount, balance, strength);

        // 4. Candidates pre-fetched and passed in by the caller
        if (candidates.isEmpty()) {
            return buildResult(new ArrayList<>(), difficultyName, avgLevel, partySize, xpBudget, shape.label());
        }

        // 5. Map pre-computed tactical roles (null → BRUTE fallback for legacy records)
        Map<Long, MonsterRole> roleMap = new HashMap<>();
        for (Creature c : candidates) {
            roleMap.put(c.Id, parseRole(c.Role));
        }

        // 6. Phase 1: select one creature per slot (count=1)
        List<EncounterSlot> slots = selectCreaturesForSlots(shape.specs(), candidates, roleMap, avgLevel, xpBudget);

        if (slots.isEmpty()) {
            return buildResult(new ArrayList<>(), difficultyName, avgLevel, partySize, xpBudget, shape.label());
        }

        // 7. Phase 2: iteratively increment counts until budget is filled
        fitByLowestCount(slots, xpBudget, xpCeiling);

        // 8. Phase 3: if still under budget, add filler creature.
        //    If groupCount was explicitly set (>= 1), the caller wants exactly that many groups:
        //    grow existing slot counts via round-robin. If groupCount was auto (negative), a
        //    new creature type is acceptable as a filler — add it as a new slot.
        if (adjustedXp(slots) < xpBudget) {
            if (groupCount >= 1) {
                fitByRoundRobin(slots, xpBudget, xpCeiling);
            } else {
                topUpEncounter(slots, candidates, roleMap, xpBudget, xpCeiling);
            }
        }

        return buildResult(slots, difficultyName, avgLevel, partySize, xpBudget, shape.label());
    }

    // -------------------------------------------------------------------------
    // Phase 1: creature selection per slot
    // -------------------------------------------------------------------------

    private static List<EncounterSlot> selectCreaturesForSlots(SlotSpec[] specs,
                                                                 List<Creature> candidates,
                                                                 Map<Long, MonsterRole> roleMap,
                                                                 int avgLevel, int xpBudget) {
        List<EncounterSlot> slots = new ArrayList<>();

        // Estimate expected multiplier from min-counts
        int estimatedCount = 0;
        for (SlotSpec s : specs) estimatedCount += s.minCount;
        double estimatedMult = getMultiplierForGroupSize(Math.max(estimatedCount, specs.length));

        for (SlotSpec spec : specs) {
            double minCR = avgLevel * spec.minCrFraction;
            double maxCR = Math.max(avgLevel * spec.maxCrFraction, 1);

            // XP target per creature: budget share / minCount, adjusted for multiplier
            double targetXpRaw = (xpBudget / estimatedMult) * spec.budgetFraction / spec.minCount;
            int maxXpForSlot = (int) (targetXpRaw * 1.5);
            int minXpForSlot = (int) (targetXpRaw * 0.3);
            maxXpForSlot = Math.max(maxXpForSlot, 25);

            // 4-tier fallback filter: Role+CR+XP band → CR+XP band → XP band only → XP cap only
            Set<MonsterRole> prefSet = Set.of(spec.preferredRoles);
            final double fMinCR = minCR, fMaxCR = maxCR;
            final int fMinXp = minXpForSlot, fMaxXp = maxXpForSlot;

            List<Creature> pool = filter(candidates, c -> {
                double cr = c.CR.numeric;
                return cr >= fMinCR && cr <= fMaxCR && c.XP >= fMinXp && c.XP <= fMaxXp
                        && prefSet.contains(roleMap.get(c.Id));
            });
            if (pool.isEmpty()) pool = filter(candidates, c -> {
                double cr = c.CR.numeric;
                return cr >= fMinCR && cr <= fMaxCR && c.XP >= fMinXp && c.XP <= fMaxXp;
            });
            if (pool.isEmpty()) pool = filter(candidates, c -> c.XP >= fMinXp && c.XP <= fMaxXp);
            if (pool.isEmpty()) pool = filter(candidates, c -> c.XP <= fMaxXp);
            if (pool.isEmpty()) pool = candidates;

            Creature selected = weightedSelect(pool, slots, roleMap, spec.preferredRoles);
            if (selected == null) continue;

            MonsterRole role = roleMap.get(selected.Id);
            EncounterSlot slot = new EncounterSlot(selected, 1, role);
            slots.add(slot);
        }

        return slots;
    }

    // -------------------------------------------------------------------------
    // Phase 2: Counts ans Budget anpassen
    // -------------------------------------------------------------------------

    /** Sums count and raw XP across all slots. */
    private static int[] computeTotals(List<EncounterSlot> slots) {
        int count = 0, rawXp = 0;
        for (EncounterSlot s : slots) { count += s.count; rawXp += s.creature.XP * s.count; }
        return new int[]{count, rawXp};
    }

    /** Fills slot counts toward xpBudget, preferring the slot with the lowest current count. */
    private static void fitByLowestCount(List<EncounterSlot> slots, int xpBudget, int xpCeiling) {
        int[] totals = computeTotals(slots);
        int totalCount = totals[0];
        int totalRawXp = totals[1];

        boolean progress = true;
        while (applyMultiplier(totalRawXp, totalCount) < xpBudget && progress) {
            progress = false;
            int bestSlot = -1;
            int bestCount = Integer.MAX_VALUE;
            for (int i = 0; i < slots.size(); i++) {
                EncounterSlot s = slots.get(i);
                if (s.count >= MAX_CREATURES_PER_SLOT) continue;
                if (applyMultiplier(totalRawXp + s.creature.XP, totalCount + 1) > xpCeiling) continue;
                if (s.count < bestCount) { bestCount = s.count; bestSlot = i; }
            }
            if (bestSlot >= 0) {
                EncounterSlot picked = slots.get(bestSlot);
                picked.count++;
                totalCount++;
                totalRawXp += picked.creature.XP;
                progress = true;
            }
        }
    }

    /** Fills slot counts toward xpBudget using round-robin across all slots. */
    private static void fitByRoundRobin(List<EncounterSlot> slots, int xpBudget, int xpCeiling) {
        int[] totals = computeTotals(slots);
        int totalCount = totals[0];
        int totalRawXp = totals[1];

        boolean progress = true;
        while (applyMultiplier(totalRawXp, totalCount) < xpBudget && progress) {
            progress = false;
            for (EncounterSlot s : slots) {
                if (s.count >= MAX_CREATURES_PER_SLOT) continue;
                if (applyMultiplier(totalRawXp + s.creature.XP, totalCount + 1) > xpCeiling) continue;
                s.count++;
                totalCount++;
                totalRawXp += s.creature.XP;
                progress = true;
                if (applyMultiplier(totalRawXp, totalCount) >= xpBudget) return;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Phase 3: Ergänzungskreatur wenn unter Budget
    // -------------------------------------------------------------------------

    private static void topUpEncounter(List<EncounterSlot> slots, List<Creature> candidates,
                                         Map<Long, MonsterRole> roleMap,
                                         int xpBudget, int xpCeiling) {
        int currentRaw = usedRawXp(slots);
        int currentCount = 0;
        for (EncounterSlot s : slots) currentCount += s.count;

        // Welche XP braucht die Ergänzungskreatur?
        int newCount = currentCount + 1;
        double newMult = getMultiplierForGroupSize(newCount);
        // (currentRaw + x) * newMult soll >= xpBudget und <= xpCeiling sein
        int minXp = Math.max(1, (int) Math.ceil(xpBudget / newMult) - currentRaw);
        int maxXp = (int) (xpCeiling / newMult) - currentRaw;

        if (maxXp < minXp || maxXp <= 0) return;

        List<Creature> viable = new ArrayList<>();
        for (Creature c : candidates) {
            if (c.XP >= minXp && c.XP <= maxXp) viable.add(c);
        }
        if (viable.isEmpty()) return;

        Creature selected = weightedSelect(viable, slots, roleMap, MonsterRole.values());
        if (selected == null) return;

        MonsterRole role = roleMap.get(selected.Id);
        EncounterSlot slot = new EncounterSlot(selected, 1, role);
        slots.add(slot);
    }

    // -------------------------------------------------------------------------
    // Filter
    // -------------------------------------------------------------------------

    private static List<Creature> filter(List<Creature> candidates, Predicate<Creature> pred) {
        List<Creature> result = new ArrayList<>();
        for (Creature c : candidates) if (pred.test(c)) result.add(c);
        return result;
    }

    // -------------------------------------------------------------------------
    // Gewichtete Auswahl
    // -------------------------------------------------------------------------

    private static Creature weightedSelect(List<Creature> candidates, List<EncounterSlot> filledSlots,
                                             Map<Long, MonsterRole> roleMap, MonsterRole[] preferred) {
        if (candidates.isEmpty()) return null;
        if (candidates.size() == 1) return candidates.get(0);

        Set<MonsterRole> prefSet = Set.of(preferred);

        double[] weights = new double[candidates.size()];
        double totalWeight = 0;

        for (int i = 0; i < candidates.size(); i++) {
            Creature c = candidates.get(i);
            double w = 1.0;

            // Role preference: +2.0. Thematic coherence bonuses intentionally outweigh role preference
            // so that encounters feel cohesive (e.g., all goblins, or a warband of similar creatures)
            // before prioritizing mechanical role diversity.
            if (prefSet.contains(roleMap.get(c.Id))) w += 2.0;

            for (EncounterSlot slot : filledSlots) {
                // Coherence weights by specificity: subtype (+5.0) > type (+3.0) > biome (+2.0).
                // Creatures sharing a subtype (e.g. "Goblinoid") feel more cohesive than sharing
                // a broad type ("Humanoid"), which in turn is more thematic than sharing only a biome.
                // Same-ID penalty (-1.0) prevents identical copies from monopolising all slots.
                if (c.CreatureType != null && c.CreatureType.equals(slot.creature.CreatureType)) w += 3.0;
                if (c.Subtypes != null && slot.creature.Subtypes != null
                        && !Collections.disjoint(c.Subtypes, slot.creature.Subtypes)) w += 5.0;
                if (shareBiome(c, slot.creature)) w += 2.0;
                if (c.Id.equals(slot.creature.Id)) w -= 1.0;
            }

            weights[i] = Math.max(0.1, w);
            totalWeight += weights[i];
        }

        double roll = ThreadLocalRandom.current().nextDouble() * totalWeight;
        double cumulative = 0;
        for (int i = 0; i < candidates.size(); i++) {
            cumulative += weights[i];
            if (roll <= cumulative) return candidates.get(i);
        }
        return candidates.get(candidates.size() - 1);
    }

    private static boolean shareBiome(Creature a, Creature b) {
        if (a.Biomes == null || a.Biomes.isEmpty()
                || b.Biomes == null || b.Biomes.isEmpty()) return false;
        return !Collections.disjoint(a.Biomes, b.Biomes);
    }

    // -------------------------------------------------------------------------
    // XP-Berechnung
    // -------------------------------------------------------------------------

    /** Source: DMG p.83, "Encounter Multipliers" table — adjusts raw XP to reflect tactical
     *  difficulty of fighting multiple enemies simultaneously. */
    public static double getMultiplierForGroupSize(int groupSize) {
        if (groupSize <= 1)  return 1.0;
        if (groupSize == 2)  return 1.5;
        if (groupSize <= 6)  return 2.0;
        if (groupSize <= 10) return 2.5;
        if (groupSize <= 14) return 3.0;
        return 4.0;
    }

    public static int adjustedXp(List<EncounterSlot> slots) {
        int totalRaw = 0;
        int totalCount = 0;
        for (EncounterSlot s : slots) {
            totalRaw += s.creature.XP * s.count;
            totalCount += s.count;
        }
        return applyMultiplier(totalRaw, totalCount);
    }

    /** Computes adjusted XP for a list of creatures with their counts (avoids EncounterSlot allocation). */
    public static int adjustedXpFromCounts(List<Creature> creatures, List<Integer> counts) {
        int totalRaw = 0;
        int totalCount = 0;
        for (int i = 0; i < creatures.size(); i++) {
            totalRaw += creatures.get(i).XP * counts.get(i);
            totalCount += counts.get(i);
        }
        return applyMultiplier(totalRaw, totalCount);
    }

    /** Computes adjusted XP directly from alive monster combatants, avoiding intermediate maps. */
    public static int adjustedXpFromCombatants(List<Combatant> combatants) {
        int totalRaw = 0;
        int totalCount = 0;
        for (Combatant cs : combatants) {
            if (cs instanceof MonsterCombatant mc && mc.isAlive()) {
                totalRaw += mc.CreatureRef.XP;
                totalCount++;
            }
        }
        return applyMultiplier(totalRaw, totalCount);
    }

    private static int applyMultiplier(int totalRaw, int totalCount) {
        return (int) (totalRaw * getMultiplierForGroupSize(totalCount));
    }

    private static int usedRawXp(List<EncounterSlot> slots) {
        return computeTotals(slots)[1];
    }

    private static MonsterRole parseRole(String role) {
        if (role == null) return MonsterRole.BRUTE;
        try { return MonsterRole.valueOf(role); }
        catch (IllegalArgumentException e) { return MonsterRole.BRUTE; }
    }

    private static Encounter buildResult(List<EncounterSlot> slots, String difficulty, int avgLevel,
                                           int partySize, int xpBudget, String shapeLabel) {
        return new Encounter(slots, difficulty, avgLevel, partySize, xpBudget, shapeLabel);
    }
}
