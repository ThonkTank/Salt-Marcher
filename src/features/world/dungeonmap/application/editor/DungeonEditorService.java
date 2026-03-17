package features.world.dungeonmap.application.editor;

import features.world.dungeonmap.domain.model.DungeonRoomCluster;
import features.world.dungeonmap.domain.model.DungeonLayout;
import features.world.dungeonmap.domain.model.DungeonLayoutEditResult;
import features.world.dungeonmap.domain.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.domain.model.Point2i;
import features.world.dungeonmap.infrastructure.persistence.DungeonRepository;
import features.world.dungeonmap.application.DungeonConnectionFactory;
import features.world.dungeonmap.infrastructure.persistence.DungeonTransactionSupport;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSupport;
import features.world.dungeonmap.domain.topology.DungeonCorridorTopologySupport;
import features.world.dungeonmap.domain.topology.DungeonRoomTopologySupport;

import java.sql.Connection;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Public facade for dungeon editor read/write workflows.
 */
public final class DungeonEditorService {

    private final DungeonConnectionFactory connectionFactory;

    public DungeonEditorService(DungeonConnectionFactory connectionFactory) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
    }

    public DungeonLayout loadLayout(long mapId) throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonRepository.loadLayout(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
        }
    }

    public DungeonLayoutEditResult moveCluster(long mapId, long clusterId, Point2i center) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.moveCluster(conn, mapId, clusterId, center));
    }

    public DungeonLayoutEditResult paintRoomCells(long mapId, Set<Point2i> cells) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.paintRoomCells(conn, mapId, cells));
    }

    public DungeonLayoutEditResult createGraphRoom(long mapId, Point2i center) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.createGraphRoom(conn, mapId, center));
    }

    public DungeonLayoutEditResult deleteRoomsAtCells(long mapId, Set<Point2i> cells) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.deleteRoomsAtCells(conn, mapId, cells));
    }

    public DungeonLayoutEditResult deleteGraphCluster(long mapId, long clusterId) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.deleteGraphCluster(conn, mapId, clusterId));
    }

    public DungeonLayoutEditResult paintClusterWalls(long mapId, Set<DungeonClusterEdgeRef> edgeRefs) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.paintClusterEdges(
                conn,
                mapId,
                edgeRefs,
                features.world.dungeonmap.domain.model.DungeonRoomCluster.EdgeType.WALL));
    }

    public DungeonLayoutEditResult paintClusterDoors(long mapId, Set<DungeonClusterEdgeRef> edgeRefs) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.paintClusterEdges(
                conn,
                mapId,
                edgeRefs,
                features.world.dungeonmap.domain.model.DungeonRoomCluster.EdgeType.DOOR));
    }

    public DungeonLayoutEditResult deleteClusterWalls(long mapId, Set<DungeonClusterEdgeRef> edgeRefs) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.deleteClusterEdges(
                conn,
                mapId,
                edgeRefs,
                features.world.dungeonmap.domain.model.DungeonRoomCluster.EdgeType.WALL));
    }

    public DungeonLayoutEditResult deleteClusterDoors(long mapId, Set<DungeonClusterEdgeRef> edgeRefs) throws Exception {
        return mutate(conn -> DungeonRoomTopologySupport.deleteClusterEdges(
                conn,
                mapId,
                edgeRefs,
                features.world.dungeonmap.domain.model.DungeonRoomCluster.EdgeType.DOOR));
    }

    public DungeonLayoutEditResult createCorridor(long mapId, List<Long> roomIds) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.createCorridor(conn, mapId, roomIds));
    }

    public DungeonLayoutEditResult addRoomToCorridor(long mapId, long corridorId, long roomId) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.addRoomToCorridor(conn, mapId, corridorId, roomId));
    }

    public DungeonLayoutEditResult mergeCorridors(long mapId, long keptCorridorId, long mergedCorridorId) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.mergeCorridors(conn, mapId, keptCorridorId, mergedCorridorId));
    }

    public DungeonLayoutEditResult removeRoomFromCorridor(long mapId, long corridorId, long roomId) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.removeRoomFromCorridor(conn, mapId, corridorId, roomId));
    }

    public DungeonLayoutEditResult removeRoomFromCorridors(long mapId, List<Long> corridorIds, long roomId) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.removeRoomFromCorridors(conn, mapId, corridorIds, roomId));
    }

    public DungeonLayoutEditResult deleteCorridor(long mapId, long corridorId) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.deleteCorridor(conn, mapId, corridorId));
    }

    public DungeonLayoutEditResult moveCorridorDoor(long mapId, long corridorId, long roomId, Point2i cell, DungeonRoomCluster.EdgeDirection direction)
            throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.moveCorridorDoor(conn, mapId, corridorId, roomId, cell, direction));
    }

    public DungeonLayoutEditResult resetCorridorDoor(long mapId, long corridorId, long roomId) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.resetCorridorDoor(conn, mapId, corridorId, roomId));
    }

    public DungeonLayoutEditResult addCorridorWaypoint(long mapId, long corridorId, int insertIndex, Point2i cell) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.addCorridorWaypoint(conn, mapId, corridorId, insertIndex, cell));
    }

    public DungeonLayoutEditResult moveCorridorWaypoint(long mapId, long corridorId, int waypointIndex, Point2i cell) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.moveCorridorWaypoint(conn, mapId, corridorId, waypointIndex, cell));
    }

    public DungeonLayoutEditResult deleteCorridorWaypoint(long mapId, long corridorId, int waypointIndex) throws Exception {
        return mutate(conn -> DungeonCorridorTopologySupport.deleteCorridorWaypoint(conn, mapId, corridorId, waypointIndex));
    }

    private DungeonLayoutEditResult mutate(SqlEditWork work) throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonLayoutEditResult result = DungeonTransactionSupport.inTransaction(conn, () -> work.apply(conn));
            DungeonRuntimeSupport.repairStoredRuntimeState(conn);
            return result;
        }
    }

    @FunctionalInterface
    private interface SqlEditWork {
        DungeonLayoutEditResult apply(Connection conn) throws Exception;
    }
}
