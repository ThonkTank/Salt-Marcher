package features.partyanalysis.service;

import features.creatures.model.CreatureCapabilityTag;
import features.partyanalysis.model.EncounterWeightClass;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;

import java.util.Set;

public final class EncounterWeightClassClassifier {
    private static final double MINION_SURVIVABILITY_ROUNDS_MAX = 0.35;
    private static final double MINION_OFFENSE_PRESSURE_MAX = 0.08;
    private static final double MINION_TURN_SHARE_MAX = 0.28;
    private static final double MINION_ACTION_UNITS_MAX = 1.0;
    private static final double MINION_GM_LOAD_MAX = 1.40;
    private static final double BOSS_SURVIVABILITY_ROUNDS_MIN = 1.75;
    private static final double BOSS_OFFENSE_PRESSURE_MIN = 0.20;
    private static final double BOSS_TURN_SHARE_MIN = 0.33;

    private EncounterWeightClassClassifier() {
        throw new AssertionError("No instances");
    }

    public static EncounterWeightClass classify(
            CreatureStaticRow staticRow,
            Set<CreatureCapabilityTag> capabilityTags,
            double survivabilityRounds,
            double offensePressure,
            double expectedTurnShare,
            double gmComplexityLoad) {
        if (isMinion(staticRow, capabilityTags, survivabilityRounds, offensePressure, expectedTurnShare, gmComplexityLoad)) {
            return EncounterWeightClass.MINION;
        }
        if (isBoss(staticRow, survivabilityRounds, offensePressure, expectedTurnShare)) {
            return EncounterWeightClass.BOSS;
        }
        return EncounterWeightClass.REGULAR;
    }

    public static double minionness(
            double survivabilityRounds,
            double offensePressure,
            double expectedTurnShare) {
        double survivabilityFactor = clamp01(
                (MINION_SURVIVABILITY_ROUNDS_MAX - survivabilityRounds) / MINION_SURVIVABILITY_ROUNDS_MAX);
        double offenseFactor = clamp01(
                (MINION_OFFENSE_PRESSURE_MAX - offensePressure) / MINION_OFFENSE_PRESSURE_MAX);
        double turnShareFactor = clamp01(
                (MINION_TURN_SHARE_MAX - expectedTurnShare) / MINION_TURN_SHARE_MAX);
        return (survivabilityFactor * 0.5) + (offenseFactor * 0.3) + (turnShareFactor * 0.2);
    }

    private static boolean isMinion(
            CreatureStaticRow staticRow,
            Set<CreatureCapabilityTag> capabilityTags,
            double survivabilityRounds,
            double offensePressure,
            double expectedTurnShare,
            double gmComplexityLoad) {
        return staticRow.legendaryActionUnits() <= 0.0
                && survivabilityRounds <= MINION_SURVIVABILITY_ROUNDS_MAX
                && offensePressure <= MINION_OFFENSE_PRESSURE_MAX
                && expectedTurnShare <= MINION_TURN_SHARE_MAX
                && staticRow.baseActionUnitsPerRound() <= MINION_ACTION_UNITS_MAX
                && gmComplexityLoad <= MINION_GM_LOAD_MAX
                && !capabilityTags.contains(CreatureCapabilityTag.BURST_DAMAGE);
    }

    private static boolean isBoss(
            CreatureStaticRow staticRow,
            double survivabilityRounds,
            double offensePressure,
            double expectedTurnShare) {
        boolean highSurvivability = survivabilityRounds >= BOSS_SURVIVABILITY_ROUNDS_MIN;
        boolean highOffense = offensePressure >= BOSS_OFFENSE_PRESSURE_MIN;
        boolean highTurnShare = expectedTurnShare >= BOSS_TURN_SHARE_MIN;
        boolean legendary = staticRow.legendaryActionUnits() > 0.0;
        int strongSignals = 0;
        if (highSurvivability) strongSignals++;
        if (highOffense) strongSignals++;
        if (highTurnShare) strongSignals++;
        if (legendary) strongSignals++;
        return strongSignals >= 2 && (highOffense || highTurnShare || legendary);
    }

    private static double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }
}
