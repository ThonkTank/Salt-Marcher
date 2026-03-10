package features.partyanalysis.service;

import features.partyanalysis.model.EncounterWeightClass;

public final class EncounterWeightClassClassifier {
    private static final double MINION_SURVIVABILITY_ACTIONS_MAX = 2.0;
    private static final double MINION_DAMAGE_POTENTIAL_MAX = 0.60;
    private static final double BOSS_SURVIVABILITY_ROUNDS_MIN = 1.25;
    private static final double BOSS_DAMAGE_POTENTIAL_HIGH = 1.0;
    private static final double BOSS_DAMAGE_POTENTIAL_SUPPORT = 0.35;

    private EncounterWeightClassClassifier() {
        throw new AssertionError("No instances");
    }

    public static EncounterWeightClass classify(
            double survivabilityActions,
            double survivabilityRounds,
            double normalizedDamagePotential) {
        if (isMinion(survivabilityActions, normalizedDamagePotential)) {
            return EncounterWeightClass.MINION;
        }
        if (isBoss(survivabilityRounds, normalizedDamagePotential)) {
            return EncounterWeightClass.BOSS;
        }
        return EncounterWeightClass.REGULAR;
    }

    public static double minionness(
            double survivabilityActions,
            double normalizedDamagePotential) {
        double survivabilityFactor = clamp01(
                (MINION_SURVIVABILITY_ACTIONS_MAX - survivabilityActions) / MINION_SURVIVABILITY_ACTIONS_MAX);
        double damageFactor = clamp01(
                (MINION_DAMAGE_POTENTIAL_MAX - normalizedDamagePotential) / MINION_DAMAGE_POTENTIAL_MAX);
        return (survivabilityFactor * 0.65) + (damageFactor * 0.35);
    }

    private static boolean isMinion(double survivabilityActions, double normalizedDamagePotential) {
        return survivabilityActions <= MINION_SURVIVABILITY_ACTIONS_MAX
                && normalizedDamagePotential < MINION_DAMAGE_POTENTIAL_MAX;
    }

    private static boolean isBoss(double survivabilityRounds, double normalizedDamagePotential) {
        return normalizedDamagePotential >= BOSS_DAMAGE_POTENTIAL_HIGH
                || (survivabilityRounds >= BOSS_SURVIVABILITY_ROUNDS_MIN
                && normalizedDamagePotential >= BOSS_DAMAGE_POTENTIAL_SUPPORT);
    }

    private static double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }
}
