package features.world.dungeonmap.service.runtime;

import database.DatabaseManager;
import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.readmodel.DungeonMapState;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.service.integration.campaign.DungeonCampaignStateAdapter;
import features.world.dungeonmap.service.query.readmodel.DungeonMapStateLoader;

import java.sql.Connection;
import java.util.List;

public final class DungeonRuntimeCommandService {

    private final DungeonRuntimeTraversalService traversalService = new DungeonRuntimeTraversalService();
    private final DungeonRuntimeEncounterRollService encounterRollService = new DungeonRuntimeEncounterRollService();

    public DungeonMoveResult setInitialPartyPosition(long mapId, long targetSquareId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonMapState state = DungeonMapStateLoader.load(conn, mapId);
            DungeonSquare targetSquare = state.index().findSquare(targetSquareId);
            if (targetSquare == null) {
                return new DungeonMoveResult(
                        DungeonMoveStatus.INVALID_DESTINATION,
                        null,
                        null,
                        List.of(),
                        "Startposition ist ungültig.");
            }
            DungeonEndpoint endpoint = DungeonRuntimeQueryService.resolveEndpointForSquare(state, targetSquare.squareId());
            DungeonCampaignStateAdapter.updateDungeonPosition(
                    conn,
                    mapId,
                    endpoint == null ? null : endpoint.endpointId(),
                    targetSquare.squareId());
            return new DungeonMoveResult(
                    DungeonMoveStatus.POSITION_SET,
                    endpoint == null ? null : endpoint.endpointId(),
                    targetSquare.squareId(),
                    List.of(),
                    "Startposition gesetzt.");
        }
    }

    public DungeonMoveResult movePartyToSquare(long mapId, long targetSquareId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonMapState state = DungeonMapStateLoader.load(conn, mapId);
            DungeonSquare targetSquare = state.index().findSquare(targetSquareId);
            if (targetSquare == null) {
                return new DungeonMoveResult(
                        DungeonMoveStatus.INVALID_DESTINATION,
                        null,
                        null,
                        List.of(),
                        "Zielposition ist ungültig.");
            }

            ResolvedPosition currentPosition = resolveCurrentPosition(conn, state);
            if (currentPosition.square() == null) {
                return new DungeonMoveResult(
                        DungeonMoveStatus.NO_CURRENT_POSITION,
                        null,
                        null,
                        List.of(),
                        "Party-Position fehlt.");
            }

            if (targetSquare.squareId().equals(currentPosition.square().squareId())) {
                return new DungeonMoveResult(
                        DungeonMoveStatus.MOVED_SAME_ROOM,
                        currentPosition.endpointId(),
                        currentPosition.square().squareId(),
                        List.of(),
                        "Position unverändert.");
            }

            if (traversalService.sameRoom(currentPosition.square(), targetSquare)) {
                return persistMove(conn, state, mapId, targetSquare, DungeonMoveStatus.MOVED_SAME_ROOM, List.of(), "Position im Raum aktualisiert.");
            }

            if (!traversalService.canMoveBetweenRooms(state, currentPosition.square(), targetSquare)) {
                return new DungeonMoveResult(
                        DungeonMoveStatus.NOT_CONNECTED,
                        currentPosition.endpointId(),
                        currentPosition.square().squareId(),
                        List.of(),
                        "Raum ist nicht direkt erreichbar.");
            }

            List<Long> triggeredTableIds = encounterRollService.rollEncounterTables(state.index().findArea(targetSquare.areaId()));
            String message = triggeredTableIds.isEmpty()
                    ? "Raum gewechselt."
                    : "Random Encounter ausgelöst.";
            return persistMove(conn, state, mapId, targetSquare, DungeonMoveStatus.MOVED, triggeredTableIds, message);
        }
    }

    private DungeonMoveResult persistMove(
            Connection conn,
            DungeonMapState state,
            long mapId,
            DungeonSquare targetSquare,
            DungeonMoveStatus status,
            List<Long> triggeredTableIds,
            String message
    ) throws Exception {
        DungeonEndpoint endpoint = DungeonRuntimeQueryService.resolveEndpointForSquare(state, targetSquare.squareId());
        DungeonCampaignStateAdapter.updateDungeonPosition(
                conn,
                mapId,
                endpoint == null ? null : endpoint.endpointId(),
                targetSquare.squareId());
        return new DungeonMoveResult(
                status,
                endpoint == null ? null : endpoint.endpointId(),
                targetSquare.squareId(),
                triggeredTableIds,
                message);
    }

    private ResolvedPosition resolveCurrentPosition(Connection conn, DungeonMapState state) throws Exception {
        if (state == null || state.map() == null) {
            return new ResolvedPosition(null, null);
        }
        Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
        if (currentMapId == null || !currentMapId.equals(state.map().mapId())) {
            return new ResolvedPosition(null, null);
        }

        Long currentSquareId = DungeonCampaignStateAdapter.getDungeonSquareId(conn).orElse(null);
        DungeonSquare currentSquare = state.index().findSquare(currentSquareId);
        Long currentEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
        if (currentSquare != null) {
            return new ResolvedPosition(currentSquare, currentEndpointId);
        }

        DungeonEndpoint endpoint = state.index().findEndpoint(currentEndpointId);
        if (endpoint != null) {
            return new ResolvedPosition(state.index().findSquare(endpoint.squareId()), endpoint.endpointId());
        }

        return new ResolvedPosition(null, null);
    }

    private record ResolvedPosition(DungeonSquare square, Long endpointId) {
    }
}
