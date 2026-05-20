package src.domain.dungeon.model.travel.repository;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.OverworldTarget;

public interface TravelDungeonSessionRepository {

    ActiveTravelStateData loadActiveTravelState();

    SurfaceData loadDungeonSurface(@Nullable PositionData position);

    MoveResultData moveDungeonAction(@Nullable PositionData position, String actionId);

    void saveDungeonPosition(PositionData position, List<Long> characterIds);

    boolean saveOverworldPosition(OverworldTarget target, List<Long> characterIds);
}
