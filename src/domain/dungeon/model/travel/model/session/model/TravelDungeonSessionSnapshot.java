package src.domain.dungeon.model.travel.model.session.model;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;

public final class TravelDungeonSessionSnapshot {

    private TravelDungeonSessionSnapshot() {
    }

    public record SnapshotData(
            @Nullable SurfaceData surface,
            TravelOverlayState overlayState,
            int projectionLevel
    ) {
        public SnapshotData {
            overlayState = overlayState == null ? TravelOverlayState.defaults() : overlayState;
        }
    }
}
