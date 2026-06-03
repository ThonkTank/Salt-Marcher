package src.domain.dungeon.model.runtime.travel.session;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.TravelOverlayState;

public final class TravelDungeonSessionSnapshot {

    private TravelDungeonSessionSnapshot() {
    }

    public static SnapshotData snapshot(
            @Nullable SurfaceData surface,
            TravelOverlayState overlayState,
            int projectionLevel
    ) {
        return new SnapshotData(surface, overlayState, projectionLevel);
    }

    public record SnapshotData(
            @Nullable SurfaceData surface,
            TravelOverlayState overlayState,
            int projectionLevel
    ) {
        public SnapshotData {
            overlayState = overlayState == null ? TravelDungeonSessionValues.defaultOverlayState() : overlayState;
        }
    }
}
