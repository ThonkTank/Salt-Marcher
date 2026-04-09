package features.world.dungeon.transition.repository;

import database.DatabaseManager;
import features.world.dungeon.transition.state.PersistReboundConnectionsState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Canonical transition-owned rebound persistence boundary. This successor slice owns the transaction for local
 * connection rewrites and keeps stair placement rows intact without exposing JDBC scope above the repository.
 */
@SuppressWarnings("unused")
public final class PersistReboundConnectionsRepository {

    private PersistReboundConnectionsRepository() {
    }

    public static PersistReboundConnectionsState persistReboundConnections(
            PersistReboundConnectionsState state
    ) throws SQLException {
        PersistReboundConnectionsState resolvedState = PersistReboundConnectionsState.persistReboundConnections(state);
        if (resolvedState.transitions().isEmpty()) {
            return resolvedState;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                for (PersistReboundConnectionsState.TransitionState transition : resolvedState.transitions()) {
                    persistTransition(conn, transition);
                }
                return resolvedState;
            });
        }
    }

    private static void persistTransition(
            Connection conn,
            PersistReboundConnectionsState.TransitionState transition
    ) throws SQLException {
        updateLocalConnectionRow(conn, transition);
        replacePathNodes(conn, transition.transitionId(), transition.localConnection().stairCarrier());
        replaceStopLevels(conn, transition.transitionId(), transition.localConnection().stairCarrier());
    }

    private static void updateLocalConnectionRow(
            Connection conn,
            PersistReboundConnectionsState.TransitionState transition
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_transitions SET "
                        + "placement_type=?,"
                        + "door_id=?,"
                        + "stair_anchor_cell_x=?, stair_anchor_cell_y=?, stair_anchor_level_z=?, stair_shape_kind=?, stair_shape_direction_code=?,"
                        + "stair_shape_param1=?, stair_shape_param2=?, stair_min_level_z=?, stair_max_level_z=? "
                        + "WHERE transition_id=?")) {
            bindLocalConnection(ps, transition, 1);
            ps.setLong(12, transition.transitionId());
            ps.executeUpdate();
        }
    }

    private static void bindLocalConnection(
            PreparedStatement ps,
            PersistReboundConnectionsState.TransitionState transition,
            int startIndex
    ) throws SQLException {
        PersistReboundConnectionsState.LocalConnectionState localConnection = transition.localConnection();
        switch (localConnection.kind()) {
            case DOOR -> {
                ps.setString(startIndex, "DOOR");
                ps.setLong(startIndex + 1, localConnection.doorId());
                clearStairPlacement(ps, startIndex + 2);
            }
            case STAIR -> {
                PersistReboundConnectionsState.StairCarrierState stairCarrier = localConnection.stairCarrier();
                PersistReboundConnectionsState.StairPlacementState stairPlacement = transition.stairPlacement() == null
                        ? defaultPlacement(stairCarrier)
                        : transition.stairPlacement();
                ps.setString(startIndex, "STAIR");
                ps.setNull(startIndex + 1, java.sql.Types.BIGINT);
                ps.setInt(startIndex + 2, stairPlacement.anchorX());
                ps.setInt(startIndex + 3, stairPlacement.anchorY());
                ps.setInt(startIndex + 4, stairPlacement.anchorLevelZ());
                ps.setString(startIndex + 5, stairPlacement.shapeKind());
                ps.setInt(startIndex + 6, stairPlacement.shapeDirectionCode());
                ps.setInt(startIndex + 7, stairPlacement.shapeParameter1());
                ps.setInt(startIndex + 8, stairPlacement.shapeParameter2());
                ps.setInt(startIndex + 9, stairPlacement.minLevelZ());
                ps.setInt(startIndex + 10, stairPlacement.maxLevelZ());
            }
            case NONE -> {
                ps.setNull(startIndex, java.sql.Types.VARCHAR);
                ps.setNull(startIndex + 1, java.sql.Types.BIGINT);
                clearStairPlacement(ps, startIndex + 2);
            }
        }
    }

    private static PersistReboundConnectionsState.StairPlacementState defaultPlacement(
            PersistReboundConnectionsState.StairCarrierState stairCarrier
    ) {
        return new PersistReboundConnectionsState.StairPlacementState(
                stairCarrier.anchorX(),
                stairCarrier.anchorY(),
                stairCarrier.anchorLevelZ(),
                "STACK",
                0,
                0,
                0,
                stairCarrier.anchorLevelZ(),
                stairCarrier.anchorLevelZ());
    }

    private static void clearStairPlacement(PreparedStatement ps, int startIndex) throws SQLException {
        ps.setNull(startIndex, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 1, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 2, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 3, java.sql.Types.VARCHAR);
        ps.setNull(startIndex + 4, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 5, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 6, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 7, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 8, java.sql.Types.INTEGER);
    }

    private static void replacePathNodes(
            Connection conn,
            long transitionId,
            PersistReboundConnectionsState.StairCarrierState stairCarrier
    ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_transition_stair_path_nodes WHERE transition_id=?")) {
            delete.setLong(1, transitionId);
            delete.executeUpdate();
        }
        if (stairCarrier == null || stairCarrier.pathNodes().isEmpty()) {
            return;
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_transition_stair_path_nodes(transition_id, sort_order, cell_x, cell_y, cell_z)"
                        + " VALUES(?,?,?,?,?)")) {
            for (int index = 0; index < stairCarrier.pathNodes().size(); index++) {
                PersistReboundConnectionsState.PathNodeState pathNode = stairCarrier.pathNodes().get(index);
                insert.setLong(1, transitionId);
                insert.setInt(2, index);
                insert.setInt(3, pathNode.x());
                insert.setInt(4, pathNode.y());
                insert.setInt(5, pathNode.levelZ());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceStopLevels(
            Connection conn,
            long transitionId,
            PersistReboundConnectionsState.StairCarrierState stairCarrier
    ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_transition_stair_stop_levels WHERE transition_id=?")) {
            delete.setLong(1, transitionId);
            delete.executeUpdate();
        }
        if (stairCarrier == null || stairCarrier.stopLevels().isEmpty()) {
            return;
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_transition_stair_stop_levels(transition_id, level_z) VALUES(?,?)")) {
            for (Integer stopLevel : stairCarrier.stopLevels()) {
                insert.setLong(1, transitionId);
                insert.setInt(2, stopLevel);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
