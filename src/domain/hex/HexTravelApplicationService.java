package src.domain.hex;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.HexMapSummary;
import src.domain.hex.model.map.HexTravelPositionState;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.published.HexTravelModel;
import src.domain.hex.published.HexTravelSnapshot;
import src.domain.hex.published.MoveHexPartyTokenCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.ReadStatus;

public final class HexTravelApplicationService {

    private static final long FIRST_PERSISTED_MAP_ID = 1L;
    private static final String NO_HEX_TRAVEL_SELECTED = "Keine Hex-Reiseposition ausgewaehlt.";

    private final HexMapRepository repository;
    private final PartyApplicationService party;
    private final HexTravelModel model;

    HexTravelApplicationService(
            HexMapRepository repository,
            PartyApplicationService party,
            HexTravelModel model
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.party = Objects.requireNonNull(party, "party");
        this.model = Objects.requireNonNull(model, "model");
    }

    public void movePartyToken(MoveHexPartyTokenCommand command) {
        if (command == null) {
            return;
        }
        movePartyToken(
                command.mapId(),
                command.q(),
                command.r(),
                command.partyTokenCharacterIds());
    }

    void acceptPartyTravelPosition(PartyTravelPositionsResult result) {
        model.publish(toSnapshot(projectTravel(result)));
    }

    private void movePartyToken(long mapId, int q, int r, List<Long> characterIds) {
        if (mapId < FIRST_PERSISTED_MAP_ID || characterIds == null || characterIds.isEmpty()) {
            return;
        }
        HexCoordinate coordinate = new HexCoordinate(q, r);
        Optional<HexMapSummary> summary = repository.loadSummaryById(new HexMapIdentity(mapId));
        if (summary.isEmpty() || !coordinate.insideRadius(summary.get().radius())) {
            return;
        }
        party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyOverworldTravelLocationSnapshot(mapId, coordinate.stableTileId()),
                true));
    }

    private HexTravelPositionState projectTravel(PartyTravelPositionsResult result) {
        PartyTravelPositionsResult safeResult = result == null
                ? new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null)
                : result;
        if (safeResult.status() != ReadStatus.SUCCESS) {
            return HexTravelPositionState.empty("Hex-Reise konnte nicht geladen werden.");
        }
        Object location = safeResult.partyTokenLocation();
        if (!(location instanceof PartyOverworldTravelLocationSnapshot overworld)) {
            return HexTravelPositionState.empty(NO_HEX_TRAVEL_SELECTED);
        }
        Optional<HexCoordinate> decodedCoordinate = HexCoordinate.fromStableTileId(overworld.tileId());
        if (decodedCoordinate.isEmpty()) {
            return HexTravelPositionState.empty(NO_HEX_TRAVEL_SELECTED);
        }
        HexCoordinate coordinate = decodedCoordinate.get();
        Optional<HexMapSummary> summary = repository.loadSummaryById(new HexMapIdentity(overworld.mapId()));
        if (summary.isEmpty() || !coordinate.insideRadius(summary.get().radius())) {
            return HexTravelPositionState.empty(NO_HEX_TRAVEL_SELECTED);
        }
        return HexTravelPositionState.active(
                summary.get(),
                coordinate,
                safeResult.partyTokenCharacterIds());
    }

    private static HexTravelSnapshot toSnapshot(HexTravelPositionState state) {
        HexTravelPositionState safeState = state == null
                ? HexTravelPositionState.empty(NO_HEX_TRAVEL_SELECTED)
                : state;
        if (!safeState.active()) {
            return HexTravelSnapshot.empty(safeState.statusText());
        }
        return new HexTravelSnapshot(
                true,
                safeState.mapId(),
                safeState.q(),
                safeState.r(),
                safeState.mapDisplayName() + " " + safeState.q() + "," + safeState.r(),
                safeState.statusText(),
                "nicht verfuegbar",
                "nicht verfuegbar",
                "Normal",
                safeState.hintText(),
                safeState.characterIds());
    }
}
