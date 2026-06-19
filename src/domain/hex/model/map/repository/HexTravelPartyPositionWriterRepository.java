package src.domain.hex.model.map.repository;

import java.util.List;

public interface HexTravelPartyPositionWriterRepository {

    void movePartyToken(long mapId, long tileId, List<Long> characterIds);
}
