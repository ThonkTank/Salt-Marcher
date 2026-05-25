package src.domain.dungeon.model.worldspace.model.session.model;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.MoveStatus;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.OverworldTarget;

public final class TravelDungeonSessionMovement {

    private TravelDungeonSessionMovement() {
    }

    public static MoveResultData safe(MoveResultData result) {
        return result == null
                ? new MoveResultData(MoveStatus.NO_MAP, null, null)
                : result;
    }

    public record MoveResultData(
            MoveStatus status,
            SurfaceData surface,
            @Nullable OverworldTarget externalTarget
    ) {
        public MoveResultData {
            status = status == null ? MoveStatus.NO_MAP : status;
            surface = surface == null ? TravelDungeonSessionSurface.outsideDungeonSurface(0L) : surface;
        }
    }
}
