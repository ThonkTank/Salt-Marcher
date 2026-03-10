package features.partyanalysis.service;

import features.partyanalysis.model.CreatureCapabilityTag;
import features.partyanalysis.model.EncounterWeightClass;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;

import java.util.Set;

public final class EncounterWeightClassClassifier {
    private static final double MINION_SURVIVABILITY_MAX = 1.1;
    private static final double MINION_OFFENSE_FACTOR_MAX = 0.90;
    private static final double MINION_ACTION_UNITS_MAX = 1.0;
    private static final double MINION_GM_LOAD_MAX = 1.40;
    private static final double BOSS_SURVIVABILITY_MIN = 3.5;
    private static final double BOSS_ACTION_UNITS_MIN = 1.75;
    private static final double BOSS_OFFENSE_FACTOR_MIN = 1.60;
    private static final double BOSS_GM_LOAD_MIN = 3.0;

    private EncounterWeightClassClassifier() {
        throw new AssertionError("No instances");
    }

    public static EncounterWeightClass classify(
            CreatureStaticRow staticRow,
            Set<CreatureCapabilityTag> capabilityTags,
            double survivabilityActions,
            double offensePressure,
            double averageOffensePressure,
            double gmComplexityLoad) {

        double normalizedOffense = normalizeOffense(offensePressure, averageOffensePressure);
        if (isMinion(staticRow, capabilityTags, survivabilityActions, normalizedOffense, gmComplexityLoad)) {
            return EncounterWeightClass.MINION;
        }
        if (isBoss(staticRow, capabilityTags, survivabilityActions, normalizedOffense, gmComplexityLoad)) {
            return EncounterWeightClass.BOSS;
        }
        return EncounterWeightClass.REGULAR;
    }

    public static double minionness(
            double survivabilityActions,
            double offensePressure,
            double averageOffensePressure) {
        double survivabilityFactor = clamp01((MINION_SURVIVABILITY_MAX - survivabilityActions) / MINION_SURVIVABILITY_MAX);
        double offenseFactor = clamp01((MINION_OFFENSE_FACTOR_MAX - normalizeOffense(offensePressure, averageOffensePressure))
                / MINION_OFFENSE_FACTOR_MAX);
        return (survivabilityFactor * 0.7) + (offenseFactor * 0.3);
    }

    private static boolean isMinion(
            CreatureStaticRow staticRow,
            Set<CreatureCapabilityTag> capabilityTags,
            double survivabilityActions,
            double normalizedOffense,
            double gmComplexityLoad) {
        return survivabilityActions <= MINION_SURVIVABILITY_MAX
                && normalizedOffense <= MINION_OFFENSE_FACTOR_MAX
                && staticRow.baseActionUnitsPerRound() <= MINION_ACTION_UNITS_MAX
                && gmComplexityLoad <= MINION_GM_LOAD_MAX
                && !capabilityTags.contains(CreatureCapabilityTag.BURST_DAMAGE);
    }

    private static boolean isBoss(
            CreatureStaticRow staticRow,
            Set<CreatureCapabilityTag> capabilityTags,
            double survivabilityActions,
            double normalizedOffense,
            double gmComplexityLoad) {
        boolean highSurvivability = survivabilityActions >= BOSS_SURVIVABILITY_MIN;
        boolean highActions = staticRow.baseActionUnitsPerRound() >= BOSS_ACTION_UNITS_MIN;
        boolean highOffense = normalizedOffense >= BOSS_OFFENSE_FACTOR_MIN;
        boolean highComplexityCaster = gmComplexityLoad >= BOSS_GM_LOAD_MIN
                && capabilityTags.contains(CreatureCapabilityTag.SPELLCASTER);
        boolean legendary = staticRow.legendaryActionUnits() > 0.0;

        if (legendary) {
            return highSurvivability || highActions || highOffense || gmComplexityLoad >= 2.0;
        }

        int strongSignals = 0;
        if (highSurvivability) strongSignals++;
        if (highActions) strongSignals++;
        if (highOffense) strongSignals++;
        if (highComplexityCaster) strongSignals++;
        return strongSignals >= 2;
    }

    private static double normalizeOffense(double offensePressure, double averageOffensePressure) {
        return offensePressure / Math.max(0.0001, averageOffensePressure);
    }

    private static double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }
}
