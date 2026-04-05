package features.world.dungeonmap.application.corridor;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.repository.DungeonCorridorRepository;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorApplicationService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonCorridorRepository corridorRepository;
    private final DungeonRoomRepository roomRepository;

    public DungeonCorridorApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonCorridorRepository corridorRepository,
            DungeonRoomRepository roomRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
        this.roomRepository = Objects.requireNonNull(roomRepository, "roomRepository");
    }

    public long createDoorToDoor(CreateDoorToDoorRequest request) throws SQLException {
        CreateDoorToDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.start() == null || resolvedRequest.end() == null) {
            throw new IllegalArgumentException("Door-to-door corridor creation requires mapId and both door endpoints");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                layout = authorizeRoomBoundaryDoor(conn, layout, resolvedRequest.levelZ(), resolvedRequest.start());
                layout = authorizeRoomBoundaryDoor(conn, layout, resolvedRequest.levelZ(), resolvedRequest.end());
                CorridorNode startNode = roomBoundaryNode(-1L, resolvedRequest.start());
                CorridorNode endNode = roomBoundaryNode(-2L, resolvedRequest.end());
                Corridor corridor = layout.planCorridor(
                        resolvedRequest.levelZ(),
                        List.of(startNode, endNode),
                        List.of(new CorridorSegment(-1L, startNode.nodeId(), endNode.nodeId())));
                Corridor persisted = corridorRepository.save(conn, corridor, layout);
                if (persisted.corridorId() == null) {
                    throw new SQLException("No id returned for persisted corridor");
                }
                return persisted.corridorId();
            });
        }
    }

    public void attachDoorToCorridorBoundary(AttachDoorToCorridorBoundaryRequest request) throws SQLException {
        AttachDoorToCorridorBoundaryRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.corridorId() <= 0
                || resolvedRequest.endpoint() == null
                || resolvedRequest.boundarySegment2x() == null) {
            throw new IllegalArgumentException(
                    "Door-to-boundary corridor attachment requires mapId, corridorId, door endpoint, and boundary");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                layout = authorizeRoomBoundaryDoor(conn, layout, corridor.levelZ(), resolvedRequest.endpoint());
                corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.attachedRoomNodeAtBoundary(
                        layout,
                        roomBoundaryNode(corridor.nextSyntheticNodeId(), resolvedRequest.endpoint()),
                        resolvedRequest.boundarySegment2x());
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
                }
            });
        }
    }

    public void promoteTileNodeAndMove(PromoteCorridorTileNodeRequest request) throws SQLException {
        PromoteCorridorTileNodeRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.corridorId() <= 0
                || resolvedRequest.tileCell() == null
                || resolvedRequest.targetPoint2x() == null) {
            throw new IllegalArgumentException("Tile-node promotion requires mapId, corridorId, tile, and target point");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.promotedTileNodeAndMoved(layout, resolvedRequest.tileCell(), resolvedRequest.targetPoint2x());
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
                }
            });
        }
    }

    public void moveNode(MoveCorridorNodeRequest request) throws SQLException {
        MoveCorridorNodeRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.corridorId() <= 0
                || resolvedRequest.nodeId() <= 0
                || resolvedRequest.point2x() == null) {
            throw new IllegalArgumentException("Corridor node move requires mapId, corridorId, nodeId, and point");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.movedNode(layout, resolvedRequest.nodeId(), resolvedRequest.point2x());
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
                }
            });
        }
    }

    public void moveDoor(MoveCorridorDoorRequest request) throws SQLException {
        MoveCorridorDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.corridorId() <= 0
                || resolvedRequest.sourceBoundarySegment2x() == null
                || resolvedRequest.target() == null) {
            throw new IllegalArgumentException("Corridor door move requires mapId, corridorId, source boundary, and target endpoint");
        }
        GridSegment2x targetBoundarySegment2x = GridSegment2x.boundaryEdge(
                resolvedRequest.target().roomCell(),
                resolvedRequest.target().outwardDirection());
        if (resolvedRequest.sourceBoundarySegment2x().equals(targetBoundarySegment2x)) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                layout = authorizeRoomBoundaryDoor(conn, layout, corridor.levelZ(), resolvedRequest.target());
                corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.movedDoor(
                        layout,
                        resolvedRequest.sourceBoundarySegment2x(),
                        roomBoundaryNode(-1L, resolvedRequest.target()));
                if (updated != corridor) {
                    Corridor persisted = corridorRepository.save(conn, updated, layout);
                    layout = layout.withUpdatedCorridor(persisted);
                    releaseRoomBoundaryDoor(conn, layout, persisted.levelZ(), resolvedRequest.sourceBoundarySegment2x());
                }
            });
        }
    }

    public void deleteSegment(DeleteCorridorSegmentRequest request) throws SQLException {
        DeleteCorridorSegmentRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.corridorId() <= 0 || resolvedRequest.segmentId() <= 0) {
            throw new IllegalArgumentException("Corridor segment delete requires mapId, corridorId, and segmentId");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                persistTopologyUpdate(conn, layout, corridor, corridor.deletedSegment(resolvedRequest.segmentId()));
            });
        }
    }

    public void deleteNode(DeleteCorridorNodeRequest request) throws SQLException {
        DeleteCorridorNodeRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.corridorId() <= 0 || resolvedRequest.nodeId() <= 0) {
            throw new IllegalArgumentException("Corridor node delete requires mapId, corridorId, and nodeId");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                persistTopologyUpdate(conn, layout, corridor, corridor.deletedNode(resolvedRequest.nodeId()));
            });
        }
    }

    public void deleteDoor(DeleteCorridorDoorRequest request) throws SQLException {
        DeleteCorridorDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.corridorId() <= 0
                || resolvedRequest.boundarySegment2x() == null) {
            throw new IllegalArgumentException("Corridor door delete requires mapId, corridorId, and boundary segment");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                CorridorNode node = corridor.findRoomBoundNodeAtBoundary(resolvedRequest.boundarySegment2x());
                if (node == null || node.nodeId() == null) {
                    return;
                }
                persistTopologyUpdate(conn, layout, corridor, corridor.deletedNode(node.nodeId()));
            });
        }
    }

    private void persistTopologyUpdate(
            Connection conn,
            DungeonLayout layout,
            Corridor originalCorridor,
            Corridor.CorridorTopologyUpdate update
    ) throws SQLException {
        if (conn == null || layout == null || originalCorridor == null || !update.changed() || originalCorridor.corridorId() == null) {
            return;
        }
        DungeonLayout workingLayout = releaseRemovedRoomBoundaryDoors(conn, layout, originalCorridor, update);
        if (update.components().isEmpty()) {
            corridorRepository.delete(conn, originalCorridor.corridorId());
            return;
        }
        ArrayList<Corridor.CorridorComponent> components = new ArrayList<>(update.components());
        components.sort(Comparator
                .comparingInt((Corridor.CorridorComponent component) -> component.segments().size())
                .thenComparingInt(component -> component.nodes().size())
                .reversed());
        Corridor.CorridorComponent primaryComponent = components.removeFirst();
        Corridor primaryCorridor = workingLayout.resolveCorridor(
                originalCorridor.corridorId(),
                originalCorridor.levelZ(),
                primaryComponent.nodes(),
                primaryComponent.segments(),
                primaryComponent.boundaryDoorSegments());
        Corridor persistedPrimary = corridorRepository.save(conn, primaryCorridor, workingLayout);
        workingLayout = workingLayout.withUpdatedCorridor(persistedPrimary);
        for (Corridor.CorridorComponent component : components) {
            Corridor splitCorridor = workingLayout.planCorridor(
                    originalCorridor.levelZ(),
                    component.nodes(),
                    component.segments(),
                    component.boundaryDoorSegments());
            Corridor persistedSplit = corridorRepository.save(conn, splitCorridor, workingLayout);
            workingLayout = workingLayout.withAddedCorridor(persistedSplit);
        }
    }

    private DungeonLayout authorizeRoomBoundaryDoor(
            Connection conn,
            DungeonLayout layout,
            int levelZ,
            CorridorDoorEndpoint endpoint
    ) throws SQLException {
        if (conn == null || layout == null || endpoint == null) {
            return layout;
        }
        Room room = layout.findRoom(endpoint.roomId());
        if (room == null) {
            throw new SQLException("Raum " + endpoint.roomId() + " existiert nicht");
        }
        RoomCluster cluster = layout.findCluster(room.clusterId());
        if (cluster == null) {
            throw new SQLException("Cluster " + room.clusterId() + " existiert nicht");
        }
        GridSegment2x boundarySegment2x = GridSegment2x.boundaryEdge(endpoint.roomCell(), endpoint.outwardDirection());
        RoomCluster updatedCluster = cluster.withExteriorOpening(levelZ, boundarySegment2x);
        if (updatedCluster == cluster) {
            return layout;
        }
        roomRepository.replaceClusters(conn, layout.mapId(), List.of(cluster), List.of(updatedCluster));
        return layout.withReplacedCluster(updatedCluster);
    }

    private DungeonLayout releaseRemovedRoomBoundaryDoors(
            Connection conn,
            DungeonLayout layout,
            Corridor originalCorridor,
            Corridor.CorridorTopologyUpdate update
    ) throws SQLException {
        if (conn == null || layout == null || originalCorridor == null || update == null) {
            return layout;
        }
        Set<GridSegment2x> remainingBoundaries = new LinkedHashSet<>();
        for (Corridor.CorridorComponent component : update.components()) {
            for (CorridorNode node : component.nodes()) {
                GridSegment2x boundarySegment2x = roomBoundarySegment(node);
                if (boundarySegment2x != null) {
                    remainingBoundaries.add(boundarySegment2x);
                }
            }
        }
        DungeonLayout workingLayout = layout;
        for (CorridorNode node : originalCorridor.nodes()) {
            GridSegment2x boundarySegment2x = roomBoundarySegment(node);
            if (boundarySegment2x == null || remainingBoundaries.contains(boundarySegment2x)) {
                continue;
            }
            workingLayout = releaseRoomBoundaryDoor(conn, workingLayout, originalCorridor.levelZ(), boundarySegment2x);
        }
        return workingLayout;
    }

    private DungeonLayout releaseRoomBoundaryDoor(
            Connection conn,
            DungeonLayout layout,
            int levelZ,
            GridSegment2x boundarySegment2x
    ) throws SQLException {
        if (conn == null || layout == null || boundarySegment2x == null) {
            return layout;
        }
        DungeonLayout.RoomBoundaryDescription boundary = describeExteriorRoomBoundary(layout, boundarySegment2x, levelZ);
        if (boundary == null || boundary.clusterId() == null) {
            return layout;
        }
        RoomCluster cluster = layout.findCluster(boundary.clusterId());
        if (cluster == null) {
            return layout;
        }
        RoomCluster updatedCluster = cluster.withoutExteriorOpening(levelZ, boundarySegment2x);
        if (updatedCluster == cluster) {
            return layout;
        }
        roomRepository.replaceClusters(conn, layout.mapId(), List.of(cluster), List.of(updatedCluster));
        return layout.withReplacedCluster(updatedCluster);
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = layoutRepository.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static Corridor requireCorridor(DungeonLayout layout, long corridorId) throws SQLException {
        Corridor corridor = layout == null ? null : layout.findCorridor(corridorId);
        if (corridor == null) {
            throw new SQLException("Corridor " + corridorId + " existiert nicht");
        }
        return corridor;
    }

    private static DungeonLayout.RoomBoundaryDescription describeExteriorRoomBoundary(
            DungeonLayout layout,
            GridSegment2x boundarySegment2x,
            int levelZ
    ) {
        if (layout == null || boundarySegment2x == null) {
            return null;
        }
        for (CellCoord cell : boundarySegment2x.touchingCells().stream().sorted(CellCoord.ORDER).toList()) {
            Room room = layout.roomAtCell(cell, levelZ);
            if (room == null || room.roomId() == null) {
                continue;
            }
            DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(
                    new DungeonSelectionRef.RoomBoundaryRef(room.roomId(), boundarySegment2x),
                    levelZ);
            if (boundary != null && boundary.exterior()) {
                return boundary;
            }
        }
        return null;
    }

    private static GridSegment2x roomBoundarySegment(CorridorNode node) {
        if (node == null || !node.isRoomBound() || node.roomCell() == null || node.roomBoundaryDirection() == null) {
            return null;
        }
        return GridSegment2x.boundaryEdge(node.roomCell(), node.roomBoundaryDirection());
    }

    private static CorridorNode roomBoundaryNode(long nodeId, CorridorDoorEndpoint endpoint) {
        if (endpoint == null || endpoint.roomCell() == null || endpoint.outwardDirection() == null) {
            throw new IllegalArgumentException("Corridor door endpoints require roomCell and outwardDirection");
        }
        return new CorridorNode(
                nodeId,
                GridPoint2x.edgeCenter(endpoint.roomCell(), endpoint.outwardDirection()),
                endpoint.roomId(),
                endpoint.roomCell(),
                endpoint.outwardDirection());
    }

    public record CorridorDoorEndpoint(long roomId, CellCoord roomCell, CardinalDirection outwardDirection) {
    }

    public record CreateDoorToDoorRequest(
            long mapId,
            int levelZ,
            CorridorDoorEndpoint start,
            CorridorDoorEndpoint end
    ) {
    }

    public record AttachDoorToCorridorBoundaryRequest(
            long mapId,
            long corridorId,
            CorridorDoorEndpoint endpoint,
            GridSegment2x boundarySegment2x
    ) {
    }

    public record PromoteCorridorTileNodeRequest(
            long mapId,
            long corridorId,
            int levelZ,
            CellCoord tileCell,
            GridPoint2x targetPoint2x
    ) {
    }

    public record MoveCorridorNodeRequest(long mapId, long corridorId, long nodeId, GridPoint2x point2x) {
    }

    public record MoveCorridorDoorRequest(
            long mapId,
            long corridorId,
            GridSegment2x sourceBoundarySegment2x,
            CorridorDoorEndpoint target
    ) {
    }

    public record DeleteCorridorSegmentRequest(long mapId, long corridorId, long segmentId) {
    }

    public record DeleteCorridorNodeRequest(long mapId, long corridorId, long nodeId) {
    }

    public record DeleteCorridorDoorRequest(long mapId, long corridorId, GridSegment2x boundarySegment2x) {
    }
}
