package src.domain.dungeon.model.travel.model.session.model;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.MoveStatus;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.OverworldTarget;

@SuppressWarnings("PMD.MissingStaticMethodInNonInstantiatableClass")
public final class TravelDungeonSessionMovement {

    private TravelDungeonSessionMovement() {
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
