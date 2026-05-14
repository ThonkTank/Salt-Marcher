package src.domain.travel.model.session.repository;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.travel.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.travel.model.session.model.TravelDungeonSessionMovement.MoveResultData;
import src.domain.travel.model.session.model.TravelDungeonSessionMovement.OverworldTargetData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;

public interface TravelDungeonSessionRepository {

    ActiveTravelStateData loadActiveTravelState();

    SurfaceData loadDungeonSurface(@Nullable PositionData position);

    MoveResultData moveDungeonAction(@Nullable PositionData position, String actionId);

    void saveDungeonPosition(PositionData position, List<Long> characterIds);

    boolean saveOverworldPosition(OverworldTargetData target, List<Long> characterIds);
}
