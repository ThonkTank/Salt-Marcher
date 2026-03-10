package features.encounter.calibration.service;

import java.util.List;

public final class EncounterCalibrationService {

    private EncounterCalibrationService() {
        throw new AssertionError("No instances");
    }

    public static EncounterPartyBenchmarks partyBenchmarksForLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return new EncounterPartyBenchmarks(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0);
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
                defenseArmorClassTotal(levels) / levels.size(),
                saveBonusTotal(levels, SaveAbility.STR) / levels.size(),
                saveBonusTotal(levels, SaveAbility.DEX) / levels.size(),
                saveBonusTotal(levels, SaveAbility.CON) / levels.size(),
                saveBonusTotal(levels, SaveAbility.INT) / levels.size(),
                saveBonusTotal(levels, SaveAbility.WIS) / levels.size(),
                saveBonusTotal(levels, SaveAbility.CHA) / levels.size(),
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
                expectedPlayerArmorClass(level),
                expectedSaveBonus(level, SaveAbility.STR),
                expectedSaveBonus(level, SaveAbility.DEX),
                expectedSaveBonus(level, SaveAbility.CON),
                expectedSaveBonus(level, SaveAbility.INT),
                expectedSaveBonus(level, SaveAbility.WIS),
                expectedSaveBonus(level, SaveAbility.CHA),
                size);
    }

    public static PartyRelativeMetrics partyRelativeMetrics(
            int creatureHp,
            int creatureAc,
            EncounterPartyBenchmarks party) {
        double hitChanceByParty = expectedHitChance(party.attackBonusPerAction(), creatureAc);
        double survivabilityActions = Math.max(
                0.5,
                creatureHp / Math.max(1.0, party.damagePerAction() * hitChanceByParty));
        double survivabilityRounds = survivabilityActions / Math.max(1.0, party.actionsPerRound());
        return new PartyRelativeMetrics(survivabilityActions, survivabilityRounds);
    }

    private static int clampLevel(int level) {
        return Math.max(1, Math.min(20, level));
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

    private static double expectedPlayerArmorClass(int level) {
        if (level >= 17) return 19.0;
        if (level >= 13) return 18.0;
        if (level >= 9) return 17.0;
        if (level >= 5) return 16.0;
        return 14.0;
    }

    private static double defenseArmorClassTotal(List<Integer> levels) {
        double total = 0.0;
        for (Integer rawLevel : levels) {
            total += expectedPlayerArmorClass(clampLevel(rawLevel == null ? 1 : rawLevel));
        }
        return total;
    }

    private static double saveBonusTotal(List<Integer> levels, SaveAbility ability) {
        double total = 0.0;
        for (Integer rawLevel : levels) {
            total += expectedSaveBonus(clampLevel(rawLevel == null ? 1 : rawLevel), ability);
        }
        return total;
    }

    private static double expectedSaveBonus(int level, SaveAbility ability) {
        double base = switch (ability) {
            case STR -> 2.0;
            case DEX -> 4.0;
            case CON -> 3.0;
            case INT -> 1.0;
            case WIS -> 3.0;
            case CHA -> 2.0;
        };
        double progression;
        if (level >= 17) progression = 4.5;
        else if (level >= 13) progression = 3.5;
        else if (level >= 9) progression = 2.5;
        else if (level >= 5) progression = 1.5;
        else progression = 0.5;
        return base + progression;
    }

    public record EncounterPartyBenchmarks(
            double actionsPerRound,
            double damagePerAction,
            double attackBonusPerAction,
            double partyHpPool,
            double targetAcStandard,
            double saveBonusStr,
            double saveBonusDex,
            double saveBonusCon,
            double saveBonusInt,
            double saveBonusWis,
            double saveBonusCha,
            int partySize
    ) {
        public int damagePerActionInt() {
            return (int) Math.round(damagePerAction);
        }

        public double saveBonus(SaveAbility ability) {
            return switch (ability) {
                case STR -> saveBonusStr;
                case DEX -> saveBonusDex;
                case CON -> saveBonusCon;
                case INT -> saveBonusInt;
                case WIS -> saveBonusWis;
                case CHA -> saveBonusCha;
            };
        }
    }

    public enum SaveAbility {
        STR,
        DEX,
        CON,
        INT,
        WIS,
        CHA
    }

    public record PartyRelativeMetrics(
            double survivabilityActions,
            double survivabilityRounds
    ) {}
}
