package features.dungeon.application.travel.session;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.OverlayState;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.SurfaceData;

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
