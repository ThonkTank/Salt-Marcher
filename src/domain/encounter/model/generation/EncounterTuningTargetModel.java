package src.domain.encounter.model.generation;

final class EncounterTuningTargetModel {

    private static final int MAX_TARGET_CREATURES = 8;

    private EncounterTuningTargetModel() {
    }

    static EncounterTuningTargets targetsFor(EncounterTuningIntent tuning, int partySize) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        int diversity = effective.diversityLevel();
        int targetCreatures = targetCreatureCount(effective.amountValue(), Math.max(1, partySize), diversity);
        return new EncounterTuningTargets(
                targetCreatures,
                Math.max(1, (int) Math.ceil(targetCreatures * 0.30)),
                diversity,
                Math.min(4, Math.max(diversity, diversity + 1)));
    }

    private static int targetCreatureCount(double amountValue, int partySize, int diversity) {
        int rounded = Math.max(1, Math.min(5, (int) Math.round(amountValue)));
        double target = switch (rounded) {
            case 1 -> 1.0 + Math.max(0, diversity - 1) * 0.35;
            case 2 -> 2.0 + diversity * 0.50;
            case 3 -> Math.max(3.0, partySize * 0.90 + diversity * 0.50);
            case 4 -> partySize * 1.25 + diversity * 0.85;
            default -> partySize * 1.70 + diversity;
        };
        return Math.max(diversity, Math.min(MAX_TARGET_CREATURES, (int) Math.ceil(target)));
    }
}
