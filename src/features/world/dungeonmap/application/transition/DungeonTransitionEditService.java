package features.world.dungeonmap.application.transition;

import database.DatabaseManager;
import features.campaignstate.api.CampaignStateApi;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.persistence.DungeonTransitionSchemaSupport;
import features.world.dungeonmap.persistence.DungeonTransitionWriteRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonTransitionEditService {

    private final DungeonRoomTopologyService roomTopologyService;
    private final DungeonTransitionWriteRepository transitionWriteRepository;

    public DungeonTransitionEditService(
            DungeonRoomTopologyService roomTopologyService,
            DungeonTransitionWriteRepository transitionWriteRepository
    ) {
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.transitionWriteRepository = Objects.requireNonNull(transitionWriteRepository, "transitionWriteRepository");
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
                DungeonTransitionSchemaSupport.ensureCompatibility(conn);
                roomTopologyService.ensureTraversableCell(conn, layout.mapId(), anchorCell.toPoint2i(), levelZ);
                DungeonTransitionDestination destination = resolveDestination(conn, resolvedRequest);
                CubePoint anchor = CubePoint.at(anchorCell, levelZ);
                long transitionId = transitionWriteRepository.insert(conn, new DungeonTransition(
                        null,
                        layout.mapId(),
                        resolvedRequest.description(),
                        anchor,
                        destination,
                        null));
                if (resolvedRequest.bidirectional()
                        && destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionWriteRepository.insert(conn, new DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            resolvedRequest.description(),
                            null,
                            new DungeonTransitionDestination.DungeonMapDestination(layout.mapId(), transitionId),
                            transitionId));
                    transitionWriteRepository.updateTargetTransition(conn, transitionId, counterpartId);
                    transitionWriteRepository.updateLinkedTransition(conn, transitionId, counterpartId);
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
                DungeonTransitionSchemaSupport.ensureCompatibility(conn);
                DungeonTransition transition = requireTransition(conn, transitionId);
                roomTopologyService.ensureTraversableCell(conn, transition.mapId(), anchorCell.toPoint2i(), levelZ);
                transitionWriteRepository.updatePlacement(conn, transitionId, CubePoint.at(anchorCell, levelZ));
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
                DungeonTransitionSchemaSupport.ensureCompatibility(conn);
                transitionWriteRepository.clearLinksTo(conn, transitionId);
                transitionWriteRepository.delete(conn, transitionId);
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

    private static DungeonTransition requireTransition(Connection conn, Long transitionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y, level_z, destination_type,"
                        + " target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                        + " target_transition_id, linked_transition_id"
                        + " FROM dungeon_transitions WHERE transition_id=?")) {
            ps.setLong(1, transitionId == null ? -1L : transitionId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Übergang existiert nicht");
                }
                CubePoint anchor = rs.getObject("cell_x") == null
                        ? null
                        : new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("level_z"));
                DungeonTransitionDestination destination;
                String destinationType = rs.getString("destination_type");
                if ("DUNGEON_MAP".equals(destinationType)) {
                    long destinationMapId = rs.getLong("target_dungeon_map_id");
                    Long targetTransitionId = nullableLong(rs, "target_transition_id");
                    destination = new DungeonTransitionDestination.DungeonMapDestination(destinationMapId, targetTransitionId);
                } else {
                    destination = new DungeonTransitionDestination.OverworldTileDestination(
                            rs.getLong("target_overworld_map_id"),
                            rs.getLong("target_overworld_tile_id"));
                }
                return new DungeonTransition(
                        rs.getLong("transition_id"),
                        rs.getLong("dungeon_map_id"),
                        rs.getString("description"),
                        anchor,
                        destination,
                        nullableLong(rs, "linked_transition_id"));
            }
        }
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
