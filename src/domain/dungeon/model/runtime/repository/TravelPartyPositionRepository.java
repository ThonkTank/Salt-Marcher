package src.domain.dungeon.model.runtime.repository;

import java.util.List;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.OverworldTarget;

public interface TravelPartyPositionRepository {

    boolean saveDungeonPosition(PositionData position, List<Long> characterIds);

    boolean saveOverworldPosition(OverworldTarget target, List<Long> characterIds);
}
