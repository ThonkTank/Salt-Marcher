package features.dungeon.domain.core.structure.feature;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.topology.DungeonMapTopology.DungeonTopologyBinding;

public record FeatureMarkerCatalog(
        List<FeatureMarker> markers
) {
    private static final long NO_MARKER_ID = 0L;

    public FeatureMarkerCatalog {
        markers = markers == null ? List.of() : List.copyOf(markers);
    }

    public static FeatureMarkerCatalog empty() {
        return new FeatureMarkerCatalog(List.of());
    }

    public FeatureMarkerCatalog withCreated(
            long markerId,
            DungeonMapIdentity mapId,
            FeatureMarkerKind kind,
            Cell anchor,
            String label,
            String description
    ) {
        List<FeatureMarker> nextMarkers = new ArrayList<>(markers);
        nextMarkers.add(new FeatureMarker(
                markerId,
                mapId,
                kind,
                anchor,
                label,
                description));
        return new FeatureMarkerCatalog(nextMarkers);
    }

    public boolean canDelete(long markerId) {
        if (markerId <= NO_MARKER_ID) {
            return false;
        }
        for (FeatureMarker marker : markers) {
            if (marker.markerId() == markerId) {
                return true;
            }
        }
        return false;
    }

    public FeatureMarkerCatalog withSemantics(long markerId, String label, String description) {
        if (!canDelete(markerId)) {
            return this;
        }
        List<FeatureMarker> nextMarkers = new ArrayList<>();
        for (FeatureMarker marker : markers) {
            nextMarkers.add(marker.markerId() == markerId
                    ? marker.withSemantics(label, description)
                    : marker);
        }
        return new FeatureMarkerCatalog(nextMarkers);
    }

    public FeatureMarkerCatalog withoutMarker(long markerId) {
        if (!canDelete(markerId)) {
            return this;
        }
        List<FeatureMarker> nextMarkers = new ArrayList<>();
        for (FeatureMarker marker : markers) {
            if (marker.markerId() != markerId) {
                nextMarkers.add(marker);
            }
        }
        return new FeatureMarkerCatalog(nextMarkers);
    }

    public List<DungeonTopologyBinding> topologyBindings() {
        List<DungeonTopologyBinding> result = new ArrayList<>();
        for (FeatureMarker marker : markers) {
            result.add(new DungeonTopologyBinding(
                    marker.topologyRef(),
                    0L,
                    0L,
                    marker.label()));
        }
        return List.copyOf(result);
    }

    public long nextMarkerId() {
        long highest = 0L;
        for (FeatureMarker marker : markers) {
            highest = Math.max(highest, marker.markerId());
        }
        return highest + 1L;
    }
}
