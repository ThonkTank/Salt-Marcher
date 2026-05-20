package src.domain.dungeon.model.travel.repository;

import java.util.List;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.OverworldTarget;

public interface TravelPartyStateRepository {

    ActiveTravelStateData loadActiveTravelState();

    void saveDungeonPosition(PositionData position, List<Long> characterIds);

    boolean saveOverworldPosition(OverworldTarget target, List<Long> characterIds);
}
