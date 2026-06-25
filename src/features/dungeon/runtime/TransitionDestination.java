package src.features.dungeon.runtime;

public record TransitionDestination(
        String destinationType,
        long targetMapId,
        long targetTileId,
        long targetTransitionId
) {
    public TransitionDestination {
        destinationType = safeText(destinationType);
        targetMapId = Math.max(0L, targetMapId);
        targetTileId = Math.max(0L, targetTileId);
        targetTransitionId = Math.max(0L, targetTransitionId);
    }

    public static TransitionDestination empty() {
        return new TransitionDestination("", 0L, 0L, 0L);
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
