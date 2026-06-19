package src.domain.hex.model.map.repository;

import src.domain.hex.model.map.HexTravelPositionState;

public interface HexTravelPublishedStateRepository {

    void publish(HexTravelPositionState state);
}
