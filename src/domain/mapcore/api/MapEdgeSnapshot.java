package src.domain.mapcore.published;

import org.jspecify.annotations.Nullable;

/**
 * Immutable edge overlay published to shared map views.
 */
public record MapEdgeSnapshot(
        MapEdgeRef ref,
        String kind,
        String label,
        @Nullable MapSelectionRef selectionRef
) {

    public MapEdgeSnapshot {
        kind = kind == null || kind.isBlank() ? "edge" : kind;
        label = label == null ? "" : label;
    }
}
