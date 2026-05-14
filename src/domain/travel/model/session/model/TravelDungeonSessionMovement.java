package src.domain.travel.model.session.model;

import org.jspecify.annotations.Nullable;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;

public final class TravelDungeonSessionMovement {

    private TravelDungeonSessionMovement() {
    }

    public record MoveResultData(
            MoveStatus status,
            SurfaceData surface,
            @Nullable OverworldTargetData externalTarget
    ) {
        public MoveResultData {
            status = status == null ? MoveStatus.NO_MAP : status;
            surface = surface == null ? TravelDungeonSessionSurface.outsideDungeonSurface(0L) : surface;
        }
    }

    public enum MoveStatus {
        SUCCESS,
        INVALID_ACTION,
        TARGET_UNAVAILABLE,
        EXTERNAL_TARGET,
        NO_MAP;

        public boolean isSuccess() {
            return this == SUCCESS;
        }

        public boolean isExternalTarget() {
            return this == EXTERNAL_TARGET;
        }
    }

    public record OverworldTargetData(long mapId, long tileId) {
        public OverworldTargetData {
            mapId = Math.max(1L, mapId);
            tileId = Math.max(0L, tileId);
        }
    }
}
