package src.domain.hex.model.map.repository;

import java.util.List;
import src.domain.hex.model.map.HexCoordinate;

public interface HexTravelPartyPositionRepository {

    void movePartyToken(long mapId, HexCoordinate coordinate, List<Long> characterIds);
}
