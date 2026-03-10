package features.encounter.generation.service;

import java.util.List;

import features.encounter.combat.model.Combatant;
import features.creatures.model.Creature;
import features.encounter.model.EncounterSlot;
import features.encounter.combat.model.MonsterCombatant;
import shared.rules.service.XpCalculator;

public final class EncounterScoring {
    private EncounterScoring() {
        throw new AssertionError("No instances");
    }

    /** Source: DMG p.83, encounter multipliers. */
    public static double multiplierForGroupSize(int groupSize) {
        return XpCalculator.multiplierForGroupSize(groupSize);
    }

    public static int adjustedXp(List<EncounterSlot> slots) {
        int totalRaw = 0;
        int totalCount = 0;
        for (EncounterSlot s : slots) {
            totalRaw += s.getCreature().getXp() * s.getCount();
            totalCount += s.getCount();
        }
        return XpCalculator.adjustedXp(totalRaw, totalCount);
    }

    /** Computes adjusted XP for a list of creatures with their counts (avoids EncounterSlot allocation). */
    public static int adjustedXpFromCounts(List<Creature> creatures, List<Integer> counts) {
        int totalRaw = 0;
        int totalCount = 0;
        for (int i = 0; i < creatures.size(); i++) {
            totalRaw += creatures.get(i).XP * counts.get(i);
            totalCount += counts.get(i);
        }
        return XpCalculator.adjustedXp(totalRaw, totalCount);
    }

    /** Computes adjusted XP directly from alive monster combatants, avoiding intermediate maps. */
    public static int adjustedXpFromCombatants(List<Combatant> combatants) {
        int totalRaw = 0;
        int totalCount = 0;
        for (Combatant cs : combatants) {
            if (cs instanceof MonsterCombatant mc && mc.isAlive()) {
                totalRaw += mc.getCreatureRef().getXp();
                totalCount++;
            }
        }
        return XpCalculator.adjustedXp(totalRaw, totalCount);
    }

    public static int applyMultiplier(int totalRaw, int totalCount) {
        return XpCalculator.adjustedXp(totalRaw, totalCount);
    }

    public static String classifyDifficultyByBudget(int avgLevel, int partySize, int budget) {
        int easy = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.EASY) * Math.max(1, partySize);
        int medium = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.MEDIUM) * Math.max(1, partySize);
        int hard = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.HARD) * Math.max(1, partySize);
        int deadly = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.DEADLY) * Math.max(1, partySize);
        return XpCalculator.classifyDifficultyByXp(budget, easy, medium, hard, deadly);
    }

    public static String classifyDifficultyFromSlots(List<EncounterSlot> slots, int avgLevel, int partySize) {
        int easy = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.EASY) * Math.max(1, partySize);
        int medium = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.MEDIUM) * Math.max(1, partySize);
        int hard = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.HARD) * Math.max(1, partySize);
        int deadly = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.DEADLY) * Math.max(1, partySize);
        int adj = adjustedXp(slots);
        return XpCalculator.classifyDifficultyByXp(adj, easy, medium, hard, deadly);
    }

    public static String deriveShapeLabel(List<EncounterSlot> slots) {
        if (slots.isEmpty()) return "";
        int total = 0;
        int maxCount = 0;
        for (EncounterSlot s : slots) {
            total += s.getCount();
            maxCount = Math.max(maxCount, s.getCount());
        }
        if (slots.size() == 1 && total == 1) return "Einzelgegner";
        if (slots.size() == 1) return "Einzelgruppe";
        if (total >= 15) return "Schwarm";
        if (maxCount >= 5) return slots.size() + " Gruppen, Mob";
        return slots.size() + " Gruppen";
    }
}
