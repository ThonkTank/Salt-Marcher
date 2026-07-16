package features.worldplanner.domain.world;

/** Numeric disposition toward the player characters. */
public final class WorldDisposition {

    public static final int MINIMUM = -50;
    public static final int MAXIMUM = 50;
    public static final int HOSTILE_MAXIMUM = -15;
    public static final int FRIENDLY_MINIMUM = 15;

    private WorldDisposition() {
    }

    public static int clamp(int value) {
        return Math.max(MINIMUM, Math.min(MAXIMUM, value));
    }

    public static Kind kind(int value) {
        int clamped = clamp(value);
        if (clamped <= HOSTILE_MAXIMUM) {
            return Kind.HOSTILE;
        }
        if (clamped >= FRIENDLY_MINIMUM) {
            return Kind.FRIENDLY;
        }
        return Kind.NEUTRAL;
    }

    public enum Kind {
        HOSTILE,
        NEUTRAL,
        FRIENDLY
    }
}
