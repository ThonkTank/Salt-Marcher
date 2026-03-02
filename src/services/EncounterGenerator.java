package services;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

import entities.Creature;
import services.EncounterTemplate.ShapeResult;
import services.EncounterTemplate.SlotSpec;
import services.RoleClassifier.MonsterRole;

public class EncounterGenerator {

    public static final int MAX_CREATURES_PER_SLOT = 10;

    public static class Encounter {
        public List<EncounterSlot> slots;
        public String difficulty;
        public int averageLevel;
        public int partySize;
        public int xpBudget;
        public String shapeLabel;
    }

    public static class EncounterSlot {
        public Creature creature;
        public int count;
        public MonsterRole role;
    }

    /**
     * @param difficultyValue  -1 = auto, 0.0 (Easy) bis 1.0 (Deadly), kontinuierlich
     */
    public static Encounter generateEncounter(int partySize, int avgLevel, List<String> creatureTypes,
                                                List<String> subtypes, List<String> biomes,
                                                double difficultyValue, int groupCount,
                                                double balance, double strength) {
        // 1. Difficulty auflösen
        if (difficultyValue < 0) {
            double r = Math.random();
            if (r < 0.15)      difficultyValue = 0.0;
            else if (r < 0.55) difficultyValue = 0.333;
            else if (r < 0.90) difficultyValue = 0.667;
            else               difficultyValue = 1.0;
        }
        difficultyValue = Math.max(0.0, Math.min(1.0, difficultyValue));
        String difficultyName = XpCalculator.classifyDifficulty(difficultyValue);

        // 2. XP-Budget: interpoliert zwischen den 4 Schwellen
        int xpBudget = XpCalculator.interpolateThreshold(avgLevel, difficultyValue) * partySize;
        // Ceiling: interpoliert bei t+0.25, gedeckelt bei 1.0 + extra Raum für Deadly
        double ceilingT = Math.min(difficultyValue + 0.25, 1.0);
        int xpCeiling = XpCalculator.interpolateThreshold(avgLevel, ceilingT) * partySize;
        if (difficultyValue > 0.85) {
            xpCeiling = Math.max(xpCeiling, (int) (xpBudget * 1.4));
        }

        // 3. Shape dynamisch generieren
        ShapeResult shape = EncounterTemplate.generateShape(difficultyName, groupCount, balance, strength);

        // 4. Kandidaten laden
        List<Creature> candidates = repositories.CreatureRepository.getCreaturesByFilters(
                creatureTypes, 1, xpCeiling, biomes, subtypes);

        if (candidates.isEmpty()) {
            return buildResult(new ArrayList<>(), difficultyName, avgLevel, partySize, xpBudget, shape.label());
        }

        // 5. Kandidaten klassifizieren
        Map<Long, MonsterRole> roleMap = new HashMap<>();
        for (Creature c : candidates) {
            roleMap.put(c.Id, RoleClassifier.classify(c));
        }

        // 6. Phase 1: Kreatur pro Slot auswählen (count=1)
        List<EncounterSlot> slots = selectCreaturesForSlots(shape.specs(), candidates, roleMap, avgLevel, xpBudget);

        if (slots.isEmpty()) {
            return buildResult(new ArrayList<>(), difficultyName, avgLevel, partySize, xpBudget, shape.label());
        }

        // 7. Phase 2: Counts iterativ hochzählen bis Budget gefüllt
        fitCountsToBudget(slots, xpBudget, xpCeiling, false);

        // 8. Phase 3: Wenn noch unter Budget, Ergänzungskreatur hinzufügen
        //    Nur neue Slots wenn groupCount nicht explizit gesetzt
        if (adjustedXp(slots) < xpBudget) {
            if (groupCount >= 1) {
                fitCountsToBudget(slots, xpBudget, xpCeiling, true);
            } else {
                topUpEncounter(slots, candidates, roleMap, xpBudget, xpCeiling);
            }
        }

        return buildResult(slots, difficultyName, avgLevel, partySize, xpBudget, shape.label());
    }

    // -------------------------------------------------------------------------
    // Phase 1: Kreatur-Auswahl pro Slot
    // -------------------------------------------------------------------------

    private static List<EncounterSlot> selectCreaturesForSlots(SlotSpec[] specs,
                                                                 List<Creature> candidates,
                                                                 Map<Long, MonsterRole> roleMap,
                                                                 int avgLevel, int xpBudget) {
        List<EncounterSlot> slots = new ArrayList<>();

        // Erwarteten Multiplier abschätzen aus min-Counts
        int estimatedCount = 0;
        for (SlotSpec s : specs) estimatedCount += s.minCount;
        double estimatedMult = getMultiplierForGroupSize(Math.max(estimatedCount, specs.length));

        for (SlotSpec spec : specs) {
            double minCR = avgLevel * spec.minCrFraction;
            double maxCR = Math.max(avgLevel * spec.maxCrFraction, 1);

            // XP-Ziel pro Kreatur: Budget-Anteil / minCount, bereinigt um den Multiplier
            double targetXpRaw = (xpBudget / estimatedMult) * spec.budgetFraction / spec.minCount;
            int maxXpForSlot = (int) (targetXpRaw * 1.5);
            int minXpForSlot = (int) (targetXpRaw * 0.3);
            maxXpForSlot = Math.max(maxXpForSlot, 25);

            // 4-Stufen-Filter: Rolle+CR+XP-Band → CR+XP-Band → nur XP-Band → nur XP-Cap
            Set<MonsterRole> prefSet = Set.of(spec.preferredRoles);
            final double fMinCR = minCR, fMaxCR = maxCR;
            final int fMinXp = minXpForSlot, fMaxXp = maxXpForSlot;

            List<Creature> pool = filter(candidates, c -> {
                double cr = EncounterTemplate.crToNumber(c.CR);
                return cr >= fMinCR && cr <= fMaxCR && c.XP >= fMinXp && c.XP <= fMaxXp
                        && prefSet.contains(roleMap.get(c.Id));
            });
            if (pool.isEmpty()) pool = filter(candidates, c -> {
                double cr = EncounterTemplate.crToNumber(c.CR);
                return cr >= fMinCR && cr <= fMaxCR && c.XP >= fMinXp && c.XP <= fMaxXp;
            });
            if (pool.isEmpty()) pool = filter(candidates, c -> c.XP >= fMinXp && c.XP <= fMaxXp);
            if (pool.isEmpty()) pool = filter(candidates, c -> c.XP <= fMaxXp);
            if (pool.isEmpty()) pool = candidates;

            Creature selected = weightedSelect(pool, slots, roleMap, spec.preferredRoles);
            if (selected == null) continue;

            EncounterSlot slot = new EncounterSlot();
            slot.creature = selected;
            slot.count = 1;

            slot.role = roleMap.get(selected.Id);
            slots.add(slot);
        }

        return slots;
    }

    // -------------------------------------------------------------------------
    // Phase 2: Counts ans Budget anpassen
    // -------------------------------------------------------------------------

    /**
     * @param roundRobin false = Slot mit niedrigstem Count bevorzugen, true = Round-Robin
     */
    private static void fitCountsToBudget(List<EncounterSlot> slots,
                                            int xpBudget, int xpCeiling, boolean roundRobin) {
        boolean progress = true;
        while (adjustedXp(slots) < xpBudget && progress) {
            progress = false;

            if (roundRobin) {
                for (int i = 0; i < slots.size(); i++) {
                    EncounterSlot s = slots.get(i);
                    if (s.count >= MAX_CREATURES_PER_SLOT) continue;
                    s.count++;
                    if (adjustedXp(slots) > xpCeiling) { s.count--; continue; }
                    progress = true;
                    if (adjustedXp(slots) >= xpBudget) return;
                }
            } else {
                int bestSlot = -1;
                int bestCount = Integer.MAX_VALUE;
                for (int i = 0; i < slots.size(); i++) {
                    EncounterSlot s = slots.get(i);
                    if (s.count >= MAX_CREATURES_PER_SLOT) continue;
                    s.count++;
                    boolean fits = adjustedXp(slots) <= xpCeiling;
                    s.count--;
                    if (!fits) continue;
                    if (s.count < bestCount) { bestCount = s.count; bestSlot = i; }
                }
                if (bestSlot >= 0) {
                    slots.get(bestSlot).count++;
                    progress = true;
                }
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
        for (EncounterSlot s : slots) if (s.creature != null) currentCount += s.count;

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

        EncounterSlot slot = new EncounterSlot();
        slot.creature = selected;
        slot.count = 1;
        slot.role = roleMap.get(selected.Id);
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

            if (prefSet.contains(roleMap.get(c.Id))) w += 2.0;

            for (EncounterSlot slot : filledSlots) {
                if (slot.creature == null) continue;
                if (c.CreatureType != null && c.CreatureType.equals(slot.creature.CreatureType)) w += 3.0;
                if (c.Subtypes != null && slot.creature.Subtypes != null
                        && !Collections.disjoint(c.Subtypes, slot.creature.Subtypes)) w += 5.0;
                if (shareBiome(c, slot.creature)) w += 2.0;
                if (c.Id.equals(slot.creature.Id)) w -= 1.0;
            }

            weights[i] = Math.max(0.1, w);
            totalWeight += weights[i];
        }

        double roll = Math.random() * totalWeight;
        double cumulative = 0;
        for (int i = 0; i < candidates.size(); i++) {
            cumulative += weights[i];
            if (roll <= cumulative) return candidates.get(i);
        }
        return candidates.get(candidates.size() - 1);
    }

    private static boolean shareBiome(Creature a, Creature b) {
        if (a.Biomes == null || b.Biomes == null) return false;
        for (String biomeA : a.Biomes) {
            for (String biomeB : b.Biomes) {
                if (biomeA.equalsIgnoreCase(biomeB)) return true;
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // XP-Berechnung
    // -------------------------------------------------------------------------

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
            if (s.creature != null) {
                totalRaw += s.creature.XP * s.count;
                totalCount += s.count;
            }
        }
        return (int) (totalRaw * getMultiplierForGroupSize(totalCount));
    }

    private static int usedRawXp(List<EncounterSlot> slots) {
        int total = 0;
        for (EncounterSlot s : slots) {
            if (s.creature != null) total += s.creature.XP * s.count;
        }
        return total;
    }

    private static Encounter buildResult(List<EncounterSlot> slots, String difficulty, int avgLevel,
                                           int partySize, int xpBudget, String shapeLabel) {
        Encounter enc = new Encounter();
        enc.slots = slots;
        enc.difficulty = difficulty;
        enc.averageLevel = avgLevel;
        enc.partySize = partySize;
        enc.xpBudget = xpBudget;
        enc.shapeLabel = shapeLabel;
        return enc;
    }
}
