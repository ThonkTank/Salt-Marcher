package features.encounter.rules;

/**
 * Shared encounter policy constants used by combat and generation.
 */
public final class EncounterRules {
    private EncounterRules() {
        throw new AssertionError("No instances");
    }

    public static final int MOB_MIN_SIZE = 4;
    public static final int MAX_CREATURES_PER_SLOT = 10;
    public static final int MAX_ROUND_MINUTES = 15;
    public static final double MINUTES_PER_INIT_SLOT = 1.5;
    public static final int MAX_TOTAL_INIT_SLOTS =
            (int) Math.floor(MAX_ROUND_MINUTES / MINUTES_PER_INIT_SLOT); // 10
    public static final int MAX_TURNS_PER_ROUND = MAX_TOTAL_INIT_SLOTS;
}
