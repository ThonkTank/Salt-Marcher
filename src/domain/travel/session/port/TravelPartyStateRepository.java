package src.domain.travel.session.port;

import java.util.List;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;

public interface TravelPartyStateRepository {

    ApplyTravelDungeonSessionUseCase.ActiveTravelStateData loadActiveTravelState();

    void saveDungeonPosition(
            ApplyTravelDungeonSessionUseCase.PositionData position,
            List<Long> characterIds
    );

    boolean saveOverworldPosition(
            ApplyTravelDungeonSessionUseCase.OverworldTargetData target,
            List<Long> characterIds
    );
}
