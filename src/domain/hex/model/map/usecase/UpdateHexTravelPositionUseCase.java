package src.domain.hex.model.map.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.HexMapSummary;
import src.domain.hex.model.map.HexPartyTravelPositionFact;
import src.domain.hex.model.map.HexTravelPositionState;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.model.map.repository.HexTravelPublishedStateRepository;

public final class UpdateHexTravelPositionUseCase {

    private final HexMapRepository mapRepository;
    private final HexTravelPublishedStateRepository publishedStateRepository;

    public UpdateHexTravelPositionUseCase(
            HexMapRepository mapRepository,
            HexTravelPublishedStateRepository publishedStateRepository
    ) {
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.publishedStateRepository = Objects.requireNonNull(
                publishedStateRepository,
                "publishedStateRepository");
    }

    public void execute(HexPartyTravelPositionFact fact) {
        publishedStateRepository.publish(projectTravel(fact));
    }

    private HexTravelPositionState projectTravel(HexPartyTravelPositionFact fact) {
        HexPartyTravelPositionFact safeFact = fact == null
                ? HexPartyTravelPositionFact.unavailable("Hex-Reise konnte nicht geladen werden.")
                : fact;
        if (!safeFact.available()) {
            return HexTravelPositionState.empty(safeFact.unavailableText());
        }
        Optional<HexCoordinate> decodedCoordinate = HexCoordinate.fromStableTileId(safeFact.tileId());
        if (decodedCoordinate.isEmpty()) {
            return HexTravelPositionState.empty("Keine Hex-Reiseposition ausgewaehlt.");
        }
        HexCoordinate coordinate = decodedCoordinate.get();
        Optional<HexMapSummary> summary = mapRepository.loadSummaryById(new HexMapIdentity(safeFact.mapId()));
        if (summary.isEmpty() || !coordinate.insideRadius(summary.get().radius())) {
            return HexTravelPositionState.empty("Keine Hex-Reiseposition ausgewaehlt.");
        }
        return HexTravelPositionState.active(
                summary.get(),
                coordinate,
                safeFact.characterIds());
    }
}
