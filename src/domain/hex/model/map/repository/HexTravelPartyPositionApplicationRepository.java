package src.domain.hex.model.map.repository;

import java.util.List;
import java.util.Objects;
import src.domain.hex.model.map.HexCoordinate;

public final class HexTravelPartyPositionApplicationRepository implements HexTravelPartyPositionRepository {

    private final HexTravelPartyPositionWriterRepository writer;

    public HexTravelPartyPositionApplicationRepository(HexTravelPartyPositionWriterRepository writer) {
        this.writer = Objects.requireNonNull(writer, "writer");
    }

    @Override
    public void movePartyToken(long mapId, HexCoordinate coordinate, List<Long> characterIds) {
        HexCoordinate safeCoordinate = Objects.requireNonNull(coordinate, "coordinate");
        writer.movePartyToken(mapId, safeCoordinate.stableTileId(), characterIds);
    }
}
