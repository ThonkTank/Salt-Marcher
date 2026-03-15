package features.world.dungeonmap.service.runtime;

import database.DatabaseManager;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.service.integration.campaign.DungeonCampaignStateAdapter;
import features.world.dungeonmap.service.projection.DungeonMapStateLoader;

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
                        List.of(),
                        "Startposition ist ungültig.");
            }
            DungeonCampaignStateAdapter.setDungeonPosition(conn, mapId, targetSquare.squareId());
            return new DungeonMoveResult(
                    DungeonMoveStatus.POSITION_SET,
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
                        List.of(),
                        "Zielposition ist ungültig.");
            }

            ResolvedPosition currentPosition = resolveCurrentPosition(conn, state);
            if (currentPosition.square() == null) {
                return new DungeonMoveResult(
                        DungeonMoveStatus.NO_CURRENT_POSITION,
                        null,
                        List.of(),
                        "Party-Position fehlt.");
            }

            if (targetSquare.squareId().equals(currentPosition.square().squareId())) {
                return new DungeonMoveResult(
                        DungeonMoveStatus.MOVED_SAME_ROOM,
                        currentPosition.square().squareId(),
                        List.of(),
                        "Position unverändert.");
            }

            if (traversalService.sameRoom(currentPosition.square(), targetSquare)) {
                return persistMove(conn, mapId, targetSquare, DungeonMoveStatus.MOVED_SAME_ROOM, List.of(), "Position im Raum aktualisiert.");
            }

            if (!traversalService.canMoveBetweenRooms(state, currentPosition.square(), targetSquare)) {
                return new DungeonMoveResult(
                        DungeonMoveStatus.NOT_CONNECTED,
                        currentPosition.square().squareId(),
                        List.of(),
                        "Raum ist nicht direkt erreichbar.");
            }

            List<Long> triggeredTableIds = encounterRollService.rollEncounterTables(state.index().findArea(targetSquare.areaId()));
            String message = triggeredTableIds.isEmpty()
                    ? "Raum gewechselt."
                    : "Random Encounter ausgelöst.";
            return persistMove(conn, mapId, targetSquare, DungeonMoveStatus.MOVED, triggeredTableIds, message);
        }
    }

    private DungeonMoveResult persistMove(
            Connection conn,
            long mapId,
            DungeonSquare targetSquare,
            DungeonMoveStatus status,
            List<Long> triggeredTableIds,
            String message
    ) throws Exception {
        DungeonCampaignStateAdapter.setDungeonPosition(conn, mapId, targetSquare.squareId());
        return new DungeonMoveResult(
                status,
                targetSquare.squareId(),
                triggeredTableIds,
                message);
    }

    private ResolvedPosition resolveCurrentPosition(Connection conn, DungeonMapState state) throws Exception {
        if (state == null || state.map() == null) {
            return new ResolvedPosition(null);
        }
        Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
        if (currentMapId == null || !currentMapId.equals(state.map().mapId())) {
            return new ResolvedPosition(null);
        }

        Long currentSquareId = DungeonCampaignStateAdapter.getDungeonSquareId(conn).orElse(null);
        DungeonSquare currentSquare = state.index().findSquare(currentSquareId);
        if (currentSquare != null) {
            return new ResolvedPosition(currentSquare);
        }
        return new ResolvedPosition(null);
    }

    private record ResolvedPosition(DungeonSquare square) {
    }
}
