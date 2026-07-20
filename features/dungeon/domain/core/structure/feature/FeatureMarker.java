package features.dungeon.domain.core.structure.feature;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;

public record FeatureMarker(
        long markerId,
        DungeonMapIdentity mapId,
        FeatureMarkerKind kind,
        Cell anchor,
        String label,
        String description
) {
    private static final long NO_MARKER_ID = 0L;

    public FeatureMarker {
        if (markerId <= NO_MARKER_ID) {
            throw new IllegalArgumentException("markerId must be positive");
        }
        if (kind == null) {
            throw new IllegalArgumentException("kind is required");
        }
        if (anchor == null) {
            throw new IllegalArgumentException("anchor is required");
        }
        label = label == null || label.isBlank() ? defaultLabel(kind, markerId) : label.trim();
        description = description == null ? "" : description.trim();
    }

    public DungeonTopologyRef topologyRef() {
        return new DungeonTopologyRef(DungeonTopologyElementKind.FEATURE_MARKER, markerId);
    }

    public FeatureMarker withSemantics(String nextLabel, String nextDescription) {
        return new FeatureMarker(markerId, mapId, kind, anchor, nextLabel, nextDescription);
    }

    private static String defaultLabel(FeatureMarkerKind kind, long markerId) {
        return kind.name() + " " + markerId;
    }
}
