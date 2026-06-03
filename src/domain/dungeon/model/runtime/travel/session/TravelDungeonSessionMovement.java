package src.domain.dungeon.model.runtime.travel.session;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.MoveStatus;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.OverworldTarget;

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
