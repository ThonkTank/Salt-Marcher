package src.domain.dungeon.api;

/**
 * Read-only onion-slice render context carried into snapshot queries.
 */
public record OnionConfig(
        double opacity,
        int range
) {

    public OnionConfig {
        opacity = Math.max(0.0, Math.min(1.0, opacity));
        range = Math.max(0, range);
    }

    public static OnionConfig defaults() {
        return new OnionConfig(0.35, 1);
    }
}
