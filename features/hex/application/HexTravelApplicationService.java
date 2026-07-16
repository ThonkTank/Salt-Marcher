package features.hex.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexMapIdentity;
import features.hex.domain.map.HexMapSummary;
import features.hex.domain.map.HexTravelPositionState;
import features.hex.domain.map.repository.HexMapRepository;
import features.hex.api.HexTravelModel;
import features.hex.api.HexTravelSnapshot;
import features.hex.api.MoveHexPartyTokenCommand;
import features.party.api.PartyApi;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.ReadStatus;

public final class HexTravelApplicationService implements features.hex.api.HexTravelApi {

    private static final long FIRST_PERSISTED_MAP_ID = 1L;
    private static final String NO_HEX_TRAVEL_SELECTED = "Keine Hex-Reiseposition ausgewaehlt.";
    private static final String STORAGE_FAILURE_TEXT = "Hex-Reise konnte nicht geladen werden.";
    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("hex.storage-failure");

    private final HexMapRepository repository;
    private final PartyApi party;
    private final HexTravelModel model;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;

    public HexTravelApplicationService(
            HexMapRepository repository,
            PartyApi party,
            HexTravelModel model,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.party = Objects.requireNonNull(party, "party");
        this.model = Objects.requireNonNull(model, "model");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public void movePartyToken(MoveHexPartyTokenCommand command) {
        if (command == null) {
            return;
        }
        executionLane.execute(() -> movePartyToken(
                command.mapId(),
                command.q(),
                command.r(),
                command.partyTokenCharacterIds()));
    }

    public void acceptPartyTravelPosition(PartyTravelPositionsResult result) {
        executionLane.execute(() -> publishTravelPosition(result));
    }

    private void publishTravelPosition(PartyTravelPositionsResult result) {
        try {
            model.publish(toSnapshot(projectTravel(result)));
        } catch (IllegalStateException exception) {
            diagnostics.failure(STORAGE_FAILURE, exception.getClass());
            model.publish(HexTravelSnapshot.empty(STORAGE_FAILURE_TEXT));
        }
    }

    private void movePartyToken(long mapId, int q, int r, List<Long> characterIds) {
        try {
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
        } catch (IllegalStateException exception) {
            diagnostics.failure(STORAGE_FAILURE, exception.getClass());
            model.publish(HexTravelSnapshot.empty(STORAGE_FAILURE_TEXT));
        }
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
