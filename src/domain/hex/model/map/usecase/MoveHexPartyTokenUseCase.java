package src.domain.hex.model.map.usecase;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.HexMapSummary;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.model.map.repository.HexTravelPartyPositionRepository;

public final class MoveHexPartyTokenUseCase {

    private static final long FIRST_PERSISTED_MAP_ID = 1L;

    private final HexMapRepository mapRepository;
    private final HexTravelPartyPositionRepository repository;

    public MoveHexPartyTokenUseCase(
            HexMapRepository mapRepository,
            HexTravelPartyPositionRepository repository
    ) {
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public void execute(long mapId, int q, int r, List<Long> characterIds) {
        if (mapId < FIRST_PERSISTED_MAP_ID || characterIds == null || characterIds.isEmpty()) {
            return;
        }
        HexCoordinate coordinate = new HexCoordinate(q, r);
        Optional<HexMapSummary> summary = mapRepository.loadSummaryById(new HexMapIdentity(mapId));
        if (summary.isEmpty() || !coordinate.insideRadius(summary.get().radius())) {
            return;
        }
        repository.movePartyToken(mapId, coordinate, characterIds);
    }
}
