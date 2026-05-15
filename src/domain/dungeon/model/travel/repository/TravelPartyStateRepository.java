package src.domain.dungeon.model.travel.repository;

import java.util.List;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionMovement.OverworldTargetData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;

public interface TravelPartyStateRepository {

    ActiveTravelStateData loadActiveTravelState();

    void saveDungeonPosition(PositionData position, List<Long> characterIds);

    boolean saveOverworldPosition(OverworldTargetData target, List<Long> characterIds);
}
