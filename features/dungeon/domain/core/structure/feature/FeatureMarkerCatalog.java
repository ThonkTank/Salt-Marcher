package features.dungeon.domain.core.structure.feature;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.structure.topology.DungeonMapTopology.DungeonTopologyBinding;

public record FeatureMarkerCatalog(
        List<FeatureMarker> markers
) {
    public FeatureMarkerCatalog {
        markers = markers == null ? List.of() : List.copyOf(markers);
    }

    public static FeatureMarkerCatalog empty() {
        return new FeatureMarkerCatalog(List.of());
    }

    public @Nullable FeatureMarker marker(long markerId) {
        for (FeatureMarker marker : markers) {
            if (marker.markerId() == markerId) {
                return marker;
            }
        }
        return null;
    }

    public FeatureMarkerCatalog withExactChange(
            @Nullable FeatureMarker before,
            @Nullable FeatureMarker after
    ) {
        FeatureMarker identity = after == null ? before : after;
        if (identity == null) {
            throw new IllegalArgumentException("feature marker change requires identity");
        }
        FeatureMarker current = marker(identity.markerId());
        if (!Objects.equals(current, before)) {
            throw new IllegalStateException("feature marker patch does not match current authored truth");
        }
        List<FeatureMarker> nextMarkers = new ArrayList<>();
        for (FeatureMarker marker : markers) {
            if (marker.markerId() == identity.markerId()) {
                if (after != null) {
                    nextMarkers.add(after);
                }
            } else {
                nextMarkers.add(marker);
            }
        }
        if (before == null && after != null) {
            nextMarkers.add(after);
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

}
