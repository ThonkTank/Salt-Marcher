package src.domain.mapcore;

import src.domain.mapcore.published.MapSurfaceSnapshot;

/**
 * Public root for topology-neutral map contracts shared across map domains.
 */
public final class MapcoreApplicationService {

    public MapSurfaceSnapshot emptySurface() {
        return MapSurfaceSnapshot.empty();
    }
}
