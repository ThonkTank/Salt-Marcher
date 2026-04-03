package features.world.dungeonmap.application.transition;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.repository.DungeonStorageSupport;
import features.world.dungeonmap.repository.DungeonTransitionRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonTransitionEditService {

    private final DungeonRoomTopologyService roomTopologyService;
    private final DungeonTransitionRepository transitionRepository;

    public DungeonTransitionEditService(
            DungeonRoomTopologyService roomTopologyService,
            DungeonTransitionRepository transitionRepository
    ) {
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public void create(
            DungeonLayout layout,
            CellCoord anchorCell,
            int levelZ,
            DungeonTransitionEditRequest request
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (anchorCell == null) {
            throw new SQLException("Kein Zielfeld gewählt");
        }
        DungeonTransitionEditRequest resolvedRequest = requireRequest(request);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonStorageSupport.ensureReady(conn);
                roomTopologyService.ensureTraversableCell(conn, layout.mapId(), anchorCell, levelZ);
                DungeonTransitionDestination destination = resolveDestination(conn, resolvedRequest);
                long transitionId = transitionRepository.insert(conn, new DungeonTransition(
                        null,
                        layout.mapId(),
                        resolvedRequest.description(),
                        CubePoint.at(anchorCell, levelZ),
                        destination,
                        null));
                if (resolvedRequest.bidirectional()
                        && destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionRepository.insert(conn, new DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            resolvedRequest.description(),
                            null,
                            new DungeonTransitionDestination.DungeonMapDestination(layout.mapId(), transitionId),
                            transitionId));
                    transitionRepository.updateTargetTransition(conn, transitionId, counterpartId);
                    transitionRepository.updateLinkedTransition(conn, transitionId, counterpartId);
                }
                return null;
            });
        }
    }

    public void placePrepared(long transitionId, CellCoord anchorCell, int levelZ) throws SQLException {
        if (transitionId <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (anchorCell == null) {
            throw new SQLException("Kein Zielfeld gewählt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonStorageSupport.ensureReady(conn);
                DungeonTransition transition = requireTransition(conn, transitionId);
                roomTopologyService.ensureTraversableCell(conn, transition.mapId(), anchorCell, levelZ);
                transitionRepository.updatePlacement(conn, transitionId, CubePoint.at(anchorCell, levelZ));
                return null;
            });
        }
    }

    public void delete(long transitionId) throws SQLException {
        if (transitionId <= 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonStorageSupport.ensureReady(conn);
                transitionRepository.clearLinksTo(conn, transitionId);
                transitionRepository.delete(conn, transitionId);
                return null;
            });
        }
    }

    public void moveToOverworld(long tileId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                CampaignStateApi.updatePartyTile(conn, tileId);
                CampaignStateApi.clearDungeonPosition(conn);
                return null;
            });
        }
    }

    private DungeonTransitionEditRequest requireRequest(DungeonTransitionEditRequest request) throws SQLException {
        if (request == null || request.destinationType() == null) {
            throw new SQLException("Übergangsziel fehlt");
        }
        if (request.destinationType() == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE) {
            if (request.targetOverworldTileId() == null || request.targetOverworldTileId() <= 0) {
                throw new SQLException("Overworld-Zielfeld fehlt");
            }
            long overworldMapId = request.targetOverworldMapId() == null ? findMapIdForTile(request.targetOverworldTileId()) : request.targetOverworldMapId();
            if (overworldMapId <= 0) {
                throw new SQLException("Overworld-Zielfeld existiert nicht");
            }
            return new DungeonTransitionEditRequest(
                    request.description(),
                    request.destinationType(),
                    null,
                    null,
                    overworldMapId,
                    request.targetOverworldTileId(),
                    false);
        }
        if (request.targetDungeonMapId() == null || request.targetDungeonMapId() <= 0) {
            throw new SQLException("Dungeon-Zielkarte fehlt");
        }
        if (!request.bidirectional() && (request.targetTransitionId() == null || request.targetTransitionId() <= 0)) {
            throw new SQLException("Ziel-Übergang fehlt");
        }
        return request;
    }

    private DungeonTransitionDestination resolveDestination(Connection conn, DungeonTransitionEditRequest request) throws SQLException {
        if (request.destinationType() == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE) {
            long mapId = request.targetOverworldMapId() == null ? findMapIdForTile(request.targetOverworldTileId()) : request.targetOverworldMapId();
            requireOverworldTile(conn, request.targetOverworldTileId());
            return new DungeonTransitionDestination.OverworldTileDestination(mapId, request.targetOverworldTileId());
        }
        requireDungeonMap(conn, request.targetDungeonMapId());
        if (!request.bidirectional()) {
            DungeonTransition targetTransition = requireTransition(conn, request.targetTransitionId());
            if (targetTransition.mapId() != request.targetDungeonMapId()) {
                throw new SQLException("Ziel-Übergang gehört nicht zur gewählten Karte");
            }
        }
        return new DungeonTransitionDestination.DungeonMapDestination(request.targetDungeonMapId(), request.targetTransitionId());
    }

    private static void requireOverworldTile(Connection conn, Long tileId) throws SQLException {
        if (tileId == null || tileId <= 0) {
            throw new SQLException("Overworld-Zielfeld fehlt");
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM hex_tiles WHERE tile_id=?")) {
            ps.setLong(1, tileId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Overworld-Zielfeld existiert nicht");
                }
            }
        }
    }

    private static long findMapIdForTile(Long tileId) throws SQLException {
        if (tileId == null || tileId <= 0) {
            return -1L;
        }
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT map_id FROM hex_tiles WHERE tile_id=?")) {
            ps.setLong(1, tileId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong(1) : -1L;
            }
        }
    }

    private static void requireDungeonMap(Connection conn, Long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId == null ? -1L : mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Dungeon-Zielkarte existiert nicht");
                }
            }
        }
    }

    private DungeonTransition requireTransition(Connection conn, Long transitionId) throws SQLException {
        DungeonTransition transition = transitionRepository.find(conn, transitionId == null ? -1L : transitionId);
        if (transition == null) {
            throw new SQLException("Übergang existiert nicht");
        }
        return transition;
    }
}
