package src.domain.dungeon.model.runtime.travel.session;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.OverlayState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;

public final class TravelDungeonSessionSnapshot {

    private TravelDungeonSessionSnapshot() {
    }

    public static SnapshotData snapshot(
            @Nullable SurfaceData surface,
            OverlayState overlayState,
            int projectionLevel
    ) {
        return new SnapshotData(surface, overlayState, projectionLevel);
    }

    public record SnapshotData(
            @Nullable SurfaceData surface,
            OverlayState overlayState,
            int projectionLevel
    ) {
        public SnapshotData {
            overlayState = overlayState == null ? OverlayState.defaults() : overlayState;
        }
    }
}
