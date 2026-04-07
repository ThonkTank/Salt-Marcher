package features.world.dungeon.dungeonmap.corridor.application;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.model.CorridorResolutionRequest;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorMutation;
import features.world.dungeon.dungeonmap.corridor.model.CorridorNode;
import features.world.dungeon.dungeonmap.corridor.model.CorridorSegment;
import features.world.dungeon.dungeonmap.corridor.model.CorridorSpecification;
import features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeon.dungeonmap.repository.DungeonMapRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class DungeonCorridorApplicationService {

    private final DungeonMapRepository mapRepository;
    private final DungeonCorridorRepository corridorRepository;

    public DungeonCorridorApplicationService(
            DungeonMapRepository mapRepository,
            DungeonCorridorRepository corridorRepository
    ) {
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
    }

    public long createDoorToDoor(CreateDoorToDoorRequest request) throws SQLException {
        CreateDoorToDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.start() == null || resolvedRequest.end() == null) {
            throw new IllegalArgumentException("Door-to-door corridor creation requires mapId and both door endpoints");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                CorridorNode startNode = roomBoundaryNode(layout, resolvedRequest.levelZ(), -1L, resolvedRequest.start());
                CorridorNode endNode = roomBoundaryNode(layout, resolvedRequest.levelZ(), -2L, resolvedRequest.end());
                Corridor corridor = layout.resolveCorridor(new CorridorResolutionRequest(
                        new CorridorSpecification(
                                null,
                                null,
                                layout.mapId(),
                                resolvedRequest.levelZ(),
                                List.of(startNode, endNode),
                                List.of(new CorridorSegment(-1L, startNode.nodeId(), endNode.nodeId()))),
                        List.of()));
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
                || resolvedRequest.boundarySegment() == null) {
            throw new IllegalArgumentException(
                    "Door-to-boundary corridor attachment requires mapId, corridorId, door endpoint, and boundary");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.mutated(
                        new CorridorMutation.AttachRoomDoorAtBoundary(
                                resolvedRequest.doorRef(),
                                resolvedRequest.boundarySegment()),
                        layout.corridorResolutionInput(corridor));
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
                || resolvedRequest.targetPoint() == null) {
            throw new IllegalArgumentException("Tile-node promotion requires mapId, corridorId, tile, and target point");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.mutated(
                        new CorridorMutation.TileNodePromotionAndMove(
                                resolvedRequest.tileCell(),
                                resolvedRequest.targetPoint()),
                        layout.corridorResolutionInput(corridor));
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
                || resolvedRequest.point() == null) {
            throw new IllegalArgumentException("Corridor node move requires mapId, corridorId, nodeId, and point");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.mutated(
                        new CorridorMutation.NodeMove(resolvedRequest.nodeId(), resolvedRequest.point()),
                        layout.corridorResolutionInput(corridor));
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
                || resolvedRequest.sourceBoundarySegment() == null
                || resolvedRequest.targetDoorRef() == null) {
            throw new IllegalArgumentException("Corridor door move requires mapId, corridorId, source boundary, and target endpoint");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                GridSegment targetBoundarySegment2x = requiredExistingExteriorDoor(
                        layout,
                        corridor.levelZ(),
                        resolvedRequest.targetDoorRef()).anchorSegment();
                if (resolvedRequest.sourceBoundarySegment().equals(targetBoundarySegment2x)) {
                    return;
                }
                Corridor updated = corridor.mutated(
                        new CorridorMutation.DoorMove(
                                resolvedRequest.sourceBoundarySegment(),
                                resolvedRequest.targetDoorRef()),
                        layout.corridorResolutionInput(corridor));
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
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                persistTopologyUpdate(
                        conn,
                        layout,
                        corridor,
                        corridor.topologyUpdated(new CorridorMutation.DeleteSegment(resolvedRequest.segmentId())));
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
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                persistTopologyUpdate(
                        conn,
                        layout,
                        corridor,
                        corridor.topologyUpdated(new CorridorMutation.DeleteNode(resolvedRequest.nodeId())));
            });
        }
    }

    public void deleteDoor(DeleteCorridorDoorRequest request) throws SQLException {
        DeleteCorridorDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.corridorId() <= 0
                || resolvedRequest.boundarySegment() == null) {
            throw new IllegalArgumentException("Corridor door delete requires mapId, corridorId, and boundary segment");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                persistTopologyUpdate(
                        conn,
                        layout,
                        corridor,
                        corridor.topologyUpdated(new CorridorMutation.DeleteDoor(resolvedRequest.boundarySegment())));
            });
        }
    }

    private void persistTopologyUpdate(
            Connection conn,
            DungeonMap layout,
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
        DungeonMap workingLayout = layout;
        ArrayList<Corridor.CorridorComponent> components = new ArrayList<>(update.components());
        components.sort(Comparator
                .comparingInt((Corridor.CorridorComponent component) -> component.segments().size())
                .thenComparingInt(component -> component.nodes().size())
                .reversed());
        Corridor.CorridorComponent primaryComponent = components.removeFirst();
        Corridor primaryCorridor = workingLayout.resolveCorridor(new CorridorResolutionRequest(
                new CorridorSpecification(
                        originalCorridor.corridorId(),
                        originalCorridor.structureObjectId(),
                        workingLayout.mapId(),
                        originalCorridor.levelZ(),
                        primaryComponent.nodes(),
                        primaryComponent.segments()),
                primaryComponent.doors()));
        Corridor persistedPrimary = corridorRepository.save(conn, primaryCorridor, workingLayout);
        workingLayout = workingLayout.withUpdatedCorridor(persistedPrimary);
        for (Corridor.CorridorComponent component : components) {
            Corridor splitCorridor = workingLayout.resolveCorridor(new CorridorResolutionRequest(
                    new CorridorSpecification(
                            null,
                            null,
                            workingLayout.mapId(),
                            originalCorridor.levelZ(),
                            component.nodes(),
                            component.segments()),
                    component.doors()));
            Corridor persistedSplit = corridorRepository.save(conn, splitCorridor, workingLayout);
            workingLayout = workingLayout.withAddedCorridor(persistedSplit);
        }
    }

    private static DungeonMap.DoorDescription requiredExistingExteriorDoor(
            DungeonMap layout,
            int levelZ,
            DoorRef doorRef
    ) {
        if (layout == null || doorRef == null) {
            throw new IllegalArgumentException("Corridor endpoint requires an existing exterior door");
        }
        DungeonMap.DoorDescription description = layout.describeDoor(doorRef);
        if (description == null || description.levelZ() != levelZ || !description.isRoomExterior()) {
            throw new IllegalArgumentException("Korridore dürfen nur an vorhandene Außentüren andocken");
        }
        if (!layout.canAttachCorridor(description)) {
            throw new IllegalArgumentException("Korridore dürfen nur an vorhandene Außentüren andocken");
        }
        return description;
    }

    private DungeonMap requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonMap layout = mapRepository.loadMap(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static Corridor requireCorridor(DungeonMap layout, long corridorId) throws SQLException {
        Corridor corridor = layout == null ? null : layout.findCorridor(corridorId);
        if (corridor == null) {
            throw new SQLException("Corridor " + corridorId + " existiert nicht");
        }
        return corridor;
    }

    private static CorridorNode roomBoundaryNode(DungeonMap layout, int levelZ, long nodeId, DoorRef doorRef) {
        DungeonMap.DoorDescription description = requiredExistingExteriorDoor(layout, levelZ, doorRef);
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
            GridSegment boundarySegment
    ) {
    }

    public record PromoteCorridorTileNodeRequest(
            long mapId,
            long corridorId,
            int levelZ,
            GridPoint tileCell,
            GridPoint targetPoint
    ) {
    }

    public record MoveCorridorNodeRequest(long mapId, long corridorId, long nodeId, GridPoint point) {
    }

    public record MoveCorridorDoorRequest(
            long mapId,
            long corridorId,
            GridSegment sourceBoundarySegment,
            DoorRef targetDoorRef
    ) {
    }

    public record DeleteCorridorSegmentRequest(long mapId, long corridorId, long segmentId) {
    }

    public record DeleteCorridorNodeRequest(long mapId, long corridorId, long nodeId) {
    }

    public record DeleteCorridorDoorRequest(long mapId, long corridorId, GridSegment boundarySegment) {
    }
}
