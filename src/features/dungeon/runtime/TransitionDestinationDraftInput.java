package src.features.dungeon.runtime;

public record TransitionDestinationDraftInput(
        String destinationType,
        String mapId,
        String tileId,
        String transitionId,
        boolean bidirectional
) {
    public TransitionDestinationDraftInput {
        destinationType = safeText(destinationType);
        mapId = safeText(mapId);
        tileId = safeText(tileId);
        transitionId = safeText(transitionId);
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
