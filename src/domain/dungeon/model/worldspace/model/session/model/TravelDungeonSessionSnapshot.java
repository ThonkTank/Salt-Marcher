package src.domain.dungeon.model.worldspace.model.session.model;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.TravelOverlayState;

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
