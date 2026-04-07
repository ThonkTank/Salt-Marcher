package features.world.dungeonmap.corridor.application;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeonmap.cluster.model.RoomCluster;
import features.world.dungeonmap.corridor.model.Corridor;
import features.world.dungeonmap.corridor.model.CorridorNode;
import features.world.dungeonmap.corridor.model.CorridorSegment;
import features.world.dungeonmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeonmap.map.repository.DungeonLayoutRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class DungeonCorridorApplicationService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonCorridorRepository corridorRepository;

    public DungeonCorridorApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonCorridorRepository corridorRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
    }

    public long createDoorToDoor(CreateDoorToDoorRequest request) throws SQLException {
        CreateDoorToDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.start() == null || resolvedRequest.end() == null) {
            throw new IllegalArgumentException("Door-to-door corridor creation requires mapId and both door endpoints");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                CorridorNode startNode = roomBoundaryNode(layout, resolvedRequest.levelZ(), -1L, resolvedRequest.start());
                CorridorNode endNode = roomBoundaryNode(layout, resolvedRequest.levelZ(), -2L, resolvedRequest.end());
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
                || resolvedRequest.doorRef() == null
                || resolvedRequest.boundarySegment2x() == null) {
            throw new IllegalArgumentException(
                    "Door-to-boundary corridor attachment requires mapId, corridorId, door endpoint, and boundary");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.attachedRoomNodeAtBoundary(
                        layout,
                        roomBoundaryNode(layout, corridor.levelZ(), corridor.nextSyntheticNodeId(), resolvedRequest.doorRef()),
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
                || resolvedRequest.targetDoorRef() == null) {
            throw new IllegalArgumentException("Corridor door move requires mapId, corridorId, source boundary, and target endpoint");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                GridSegment targetBoundarySegment2x = requiredExistingExteriorDoor(
                        layout,
                        corridor.levelZ(),
                        resolvedRequest.targetDoorRef()).anchorSegment();
                if (resolvedRequest.sourceBoundarySegment2x().equals(targetBoundarySegment2x)) {
                    return;
                }
                Corridor updated = corridor.movedDoor(
                        layout,
                        resolvedRequest.sourceBoundarySegment2x(),
                        roomBoundaryNode(layout, corridor.levelZ(), -1L, resolvedRequest.targetDoorRef()));
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
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
        if (update.components().isEmpty()) {
            corridorRepository.delete(conn, originalCorridor.corridorId());
            return;
        }
        DungeonLayout workingLayout = layout;
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
                primaryComponent.doors());
        Corridor persistedPrimary = corridorRepository.save(conn, primaryCorridor, workingLayout);
        workingLayout = workingLayout.withUpdatedCorridor(persistedPrimary);
        for (Corridor.CorridorComponent component : components) {
            Corridor splitCorridor = workingLayout.planCorridor(
                    originalCorridor.levelZ(),
                    component.nodes(),
                    component.segments(),
                    component.doors());
            Corridor persistedSplit = corridorRepository.save(conn, splitCorridor, workingLayout);
            workingLayout = workingLayout.withAddedCorridor(persistedSplit);
        }
    }

    private static DungeonLayout.DoorDescription requiredExistingExteriorDoor(
            DungeonLayout layout,
            int levelZ,
            DoorRef doorRef
    ) {
        if (layout == null || doorRef == null) {
            throw new IllegalArgumentException("Corridor endpoint requires an existing exterior door");
        }
        DungeonLayout.DoorDescription description = layout.describeDoor(doorRef);
        if (description == null || description.levelZ() != levelZ || !description.isRoomExterior()) {
            throw new IllegalArgumentException("Korridore dürfen nur an vorhandene Außentüren andocken");
        }
        if (!layout.canAttachCorridor(description)) {
            throw new IllegalArgumentException("Korridore dürfen nur an vorhandene Außentüren andocken");
        }
        return description;
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

    private static CorridorNode roomBoundaryNode(DungeonLayout layout, int levelZ, long nodeId, DoorRef doorRef) {
        DungeonLayout.DoorDescription description = requiredExistingExteriorDoor(layout, levelZ, doorRef);
        return new CorridorNode(
                nodeId,
                description.anchorSegment().midpoint(),
                description.ref());
    }

    public record CreateDoorToDoorRequest(
            long mapId,
            int levelZ,
            DoorRef start,
            DoorRef end
    ) {
    }

    public record AttachDoorToCorridorBoundaryRequest(
            long mapId,
            long corridorId,
            DoorRef doorRef,
            GridSegment boundarySegment2x
    ) {
    }

    public record PromoteCorridorTileNodeRequest(
            long mapId,
            long corridorId,
            int levelZ,
            GridPoint tileCell,
            GridPoint targetPoint2x
    ) {
    }

    public record MoveCorridorNodeRequest(long mapId, long corridorId, long nodeId, GridPoint point2x) {
    }

    public record MoveCorridorDoorRequest(
            long mapId,
            long corridorId,
            GridSegment sourceBoundarySegment2x,
            DoorRef targetDoorRef
    ) {
    }

    public record DeleteCorridorSegmentRequest(long mapId, long corridorId, long segmentId) {
    }

    public record DeleteCorridorNodeRequest(long mapId, long corridorId, long nodeId) {
    }

    public record DeleteCorridorDoorRequest(long mapId, long corridorId, GridSegment boundarySegment2x) {
    }
}
