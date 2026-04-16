package src.domain.mapcore.api;

/**
 * Immutable edge overlay published to shared map views.
 */
public record MapEdgeSnapshot(
        MapEdgeRef ref,
        String kind,
        String label,
        MapSelectionRef selectionRef
) {

    public MapEdgeSnapshot {
        kind = kind == null || kind.isBlank() ? "edge" : kind;
        label = label == null ? "" : label;
    }
}
