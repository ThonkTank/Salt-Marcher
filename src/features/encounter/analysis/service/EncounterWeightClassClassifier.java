package features.encounter.analysis.service;

import features.encounter.analysis.model.CreatureCapabilityTag;
import features.encounter.analysis.model.EncounterWeightClass;
import features.encounter.analysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;

import java.util.Set;

public final class EncounterWeightClassClassifier {
    private static final double MINION_SURVIVABILITY_MAX = 1.1;
    private static final double MINION_OFFENSE_FACTOR_MAX = 1.00;
    private static final double MINION_ACTION_UNITS_MAX = 1.0;
    private static final double MINION_GM_LOAD_MAX = 1.75;
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
        return survivabilityActions >= BOSS_SURVIVABILITY_MIN
                || staticRow.baseActionUnitsPerRound() >= BOSS_ACTION_UNITS_MIN
                || normalizedOffense >= BOSS_OFFENSE_FACTOR_MIN
                || (gmComplexityLoad >= BOSS_GM_LOAD_MIN
                && (staticRow.legendaryActionUnits() > 0.0 || capabilityTags.contains(CreatureCapabilityTag.SPELLCASTER)));
    }

    private static double normalizeOffense(double offensePressure, double averageOffensePressure) {
        return offensePressure / Math.max(0.0001, averageOffensePressure);
    }

    private static double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }
}
