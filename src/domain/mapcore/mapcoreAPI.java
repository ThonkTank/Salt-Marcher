package src.domain.mapcore;

import src.domain.mapcore.api.MapSurfaceSnapshot;

/**
 * Public root for topology-neutral map contracts shared across map domains.
 */
public final class mapcoreAPI {

    public MapSurfaceSnapshot emptySurface() {
        return MapSurfaceSnapshot.empty();
    }
}
