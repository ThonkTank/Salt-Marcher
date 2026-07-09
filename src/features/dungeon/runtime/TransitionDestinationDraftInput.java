package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.structure.transition.TransitionDestinationType;

public record TransitionDestinationDraftInput(
        TransitionDestinationType destinationType,
        String mapId,
        String tileId,
        String transitionId,
        boolean bidirectional
) {
    public TransitionDestinationDraftInput {
        destinationType = destinationType == null
                ? TransitionDestinationType.UNLINKED_ENTRANCE
                : destinationType;
        mapId = safeText(mapId);
        tileId = safeText(tileId);
        transitionId = safeText(transitionId);
    }

    public static TransitionDestinationDraftInput unlinkedEntrance() {
        return new TransitionDestinationDraftInput(TransitionDestinationType.UNLINKED_ENTRANCE, "", "", "", true);
    }

    public static TransitionDestinationDraftInput fromExternalName(ExternalFields fields) {
        ExternalFields safeFields = fields == null ? ExternalFields.empty() : fields;
        return new TransitionDestinationDraftInput(
                TransitionDestinationType.fromExternalName(safeFields.destinationTypeName()),
                safeFields.mapId(),
                safeFields.tileId(),
                safeFields.transitionId(),
                safeFields.bidirectional());
    }

    long targetMapId() {
        return positiveLong(mapId);
    }

    long targetTileId() {
        return positiveLong(tileId);
    }

    long targetTransitionId() {
        return positiveLong(transitionId);
    }

    public record ExternalFields(
            String destinationTypeName,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional
    ) {
        public ExternalFields {
            destinationTypeName = safeText(destinationTypeName);
            mapId = safeText(mapId);
            tileId = safeText(tileId);
            transitionId = safeText(transitionId);
        }

        private static ExternalFields empty() {
            return new ExternalFields("", "", "", "", true);
        }
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }

    private static long positiveLong(String value) {
        if (value == null || value.isBlank()) {
            return 0L;
        }
        try {
            return Math.max(0L, Long.parseLong(value.strip()));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }
}
