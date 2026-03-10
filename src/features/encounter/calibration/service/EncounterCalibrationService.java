package features.encounter.calibration.service;

import java.util.List;

public final class EncounterCalibrationService {

    private EncounterCalibrationService() {
        throw new AssertionError("No instances");
    }

    public static EncounterPartyBenchmarks partyBenchmarksForLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return new EncounterPartyBenchmarks(0.0, 0.0, 0.0, 0.0, 0);
        }
        double actions = 0.0;
        double damage = 0.0;
        double attackBonus = 0.0;
        double hp = 0.0;
        for (Integer rawLevel : levels) {
            int level = clampLevel(rawLevel == null ? 1 : rawLevel);
            actions += expectedActionsPerCharacter(level);
            damage += expectedDamagePerAction(level);
            attackBonus += expectedAttackBonus(level);
            hp += expectedPlayerHp(level);
        }
        return new EncounterPartyBenchmarks(
                actions,
                damage / levels.size(),
                attackBonus / levels.size(),
                hp,
                levels.size());
    }

    public static EncounterPartyBenchmarks partyBenchmarksForAverageLevel(int avgLevel, int partySize) {
        int level = clampLevel(avgLevel);
        int size = Math.max(1, partySize);
        return new EncounterPartyBenchmarks(
                expectedActionsPerCharacter(level) * size,
                expectedDamagePerAction(level),
                expectedAttackBonus(level),
                expectedPlayerHp(level) * size,
                size);
    }

    public static PartyRelativeMetrics partyRelativeMetrics(
            int creatureHp,
            int creatureAc,
            int creatureXp,
            double actionUnitsPerRound,
            EncounterPartyBenchmarks party) {
        double hitChanceByParty = expectedHitChance(party.attackBonusPerAction(), creatureAc);
        double survivabilityActions = Math.max(
                0.5,
                creatureHp / Math.max(1.0, party.damagePerAction() * hitChanceByParty));
        double survivabilityRounds = survivabilityActions / Math.max(1.0, party.actionsPerRound());
        double offensePressure = estimateCreatureDamagePerAction(creatureXp)
                * actionUnitsPerRound
                / Math.max(1.0, party.partyHpPool());
        double expectedTurnShare = actionUnitsPerRound / Math.max(1.0, party.actionsPerRound());
        return new PartyRelativeMetrics(survivabilityActions, survivabilityRounds, offensePressure, expectedTurnShare);
    }

    private static int clampLevel(int level) {
        return Math.max(1, Math.min(20, level));
    }

    private static double estimateCreatureDamagePerAction(int xp) {
        return Math.max(2.0, Math.sqrt(Math.max(1, xp)) * 0.55);
    }

    private static double expectedHitChance(double attackBonus, int targetAc) {
        double needed = targetAc - attackBonus;
        double raw = (21.0 - needed) / 20.0;
        return Math.max(0.05, Math.min(0.95, raw));
    }

    private static double expectedActionsPerCharacter(int level) {
        if (level >= 11) return 1.45;
        if (level >= 5) return 1.30;
        return 1.10;
    }

    private static double expectedDamagePerAction(int level) {
        return 6.0 + ((level - 1) * 1.75);
    }

    private static double expectedAttackBonus(int level) {
        if (level >= 17) return 11.0;
        if (level >= 13) return 10.0;
        if (level >= 9) return 9.0;
        if (level >= 5) return 8.0;
        return 6.0;
    }

    private static double expectedPlayerHp(int level) {
        return 10.0 + (level * 7.5);
    }

    public record EncounterPartyBenchmarks(
            double actionsPerRound,
            double damagePerAction,
            double attackBonusPerAction,
            double partyHpPool,
            int partySize
    ) {
        public int damagePerActionInt() {
            return (int) Math.round(damagePerAction);
        }

    }

    public record PartyRelativeMetrics(
            double survivabilityActions,
            double survivabilityRounds,
            double offensePressure,
            double expectedTurnShare
    ) {}
}
