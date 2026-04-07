package features.world.dungeon.dungeonmap.corridor.application;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorDraft;
import features.world.dungeon.dungeonmap.corridor.model.CorridorMember;
import features.world.dungeon.dungeonmap.corridor.model.CorridorMutation;
import features.world.dungeon.dungeonmap.corridor.model.CorridorTerminal;
import features.world.dungeon.dungeonmap.model.CorridorResolutionContextRequest;
import features.world.dungeon.dungeonmap.model.CorridorResolutionRequest;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;

import java.sql.Connection;
import java.sql.SQLException;
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
                requiredExistingExteriorDoor(layout, resolvedRequest.levelZ(), resolvedRequest.start());
                requiredExistingExteriorDoor(layout, resolvedRequest.levelZ(), resolvedRequest.end());
                Corridor corridor = layout.resolveCorridor(new CorridorResolutionRequest(
                        new CorridorDraft(
                                null,
                                null,
                                layout.mapId(),
                                resolvedRequest.levelZ(),
                                new CorridorTerminal.DoorTerminal(resolvedRequest.start()),
                                List.of(new CorridorMember(-1L, new CorridorTerminal.DoorTerminal(resolvedRequest.end()), null, null)),
                                List.of()),
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
                        layout.corridorResolutionInput(CorridorResolutionContextRequest.forCorridor(corridor)));
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
                        layout.corridorResolutionInput(CorridorResolutionContextRequest.forCorridor(corridor)));
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
                || resolvedRequest.waypointId() == null
                || resolvedRequest.point() == null) {
            throw new IllegalArgumentException("Corridor waypoint move requires mapId, corridorId, waypointId, and point");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                Corridor updated = corridor.mutated(
                        new CorridorMutation.NodeMove(resolvedRequest.waypointId(), resolvedRequest.point()),
                        layout.corridorResolutionInput(CorridorResolutionContextRequest.forCorridor(corridor)));
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
                        layout.corridorResolutionInput(CorridorResolutionContextRequest.forCorridor(corridor)));
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
                }
            });
        }
    }

    public void deleteSegment(DeleteCorridorSegmentRequest request) throws SQLException {
        DeleteCorridorSegmentRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.corridorId() <= 0 || resolvedRequest.memberId() == null || resolvedRequest.segmentOrdinal() < 0) {
            throw new IllegalArgumentException("Corridor segment delete requires mapId, corridorId, memberId, and segmentOrdinal");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                CorridorDraftPlan plan = CorridorDraftPlanner.plan(
                        corridor,
                        new CorridorTopologyEdit.DeleteSegment(resolvedRequest.memberId(), resolvedRequest.segmentOrdinal()),
                        layout.corridorResolutionInput(CorridorResolutionContextRequest.forCorridor(corridor)));
                persistDraftPlan(conn, layout, corridor, plan);
            });
        }
    }

    public void deleteNode(DeleteCorridorNodeRequest request) throws SQLException {
        DeleteCorridorNodeRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.corridorId() <= 0 || resolvedRequest.waypointId() == null) {
            throw new IllegalArgumentException("Corridor waypoint delete requires mapId, corridorId, and waypointId");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                CorridorDraftPlan plan = CorridorDraftPlanner.plan(
                        corridor,
                        new CorridorTopologyEdit.DeleteWaypoint(resolvedRequest.waypointId()),
                        layout.corridorResolutionInput(CorridorResolutionContextRequest.forCorridor(corridor)));
                persistDraftPlan(conn, layout, corridor, plan);
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
                CorridorDraftPlan plan = CorridorDraftPlanner.plan(
                        corridor,
                        new CorridorTopologyEdit.DeleteDoor(resolvedRequest.boundarySegment()),
                        layout.corridorResolutionInput(CorridorResolutionContextRequest.forCorridor(corridor)));
                persistDraftPlan(conn, layout, corridor, plan);
            });
        }
    }

    private void persistDraftPlan(
            Connection conn,
            DungeonMap layout,
            Corridor originalCorridor,
            CorridorDraftPlan plan
    ) throws SQLException {
        if (conn == null || layout == null || originalCorridor == null || !plan.changed() || originalCorridor.corridorId() == null) {
            return;
        }
        if (plan.requests().isEmpty()) {
            corridorRepository.delete(conn, originalCorridor.corridorId());
            return;
        }
        DungeonMap workingLayout = layout;
        boolean first = true;
        for (CorridorResolutionRequest request : plan.requests()) {
            Corridor resolved = workingLayout.resolveCorridor(request);
            Corridor persisted = corridorRepository.save(conn, resolved, workingLayout);
            if (first) {
                workingLayout = workingLayout.withUpdatedCorridor(persisted);
                first = false;
            } else {
                workingLayout = workingLayout.withAddedCorridor(persisted);
            }
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

    public record MoveCorridorNodeRequest(long mapId, long corridorId, Long waypointId, GridPoint point) {
    }

    public record MoveCorridorDoorRequest(
            long mapId,
            long corridorId,
            GridSegment sourceBoundarySegment,
            DoorRef targetDoorRef
    ) {
    }

    public record DeleteCorridorSegmentRequest(long mapId, long corridorId, Long memberId, int segmentOrdinal) {
    }

    public record DeleteCorridorNodeRequest(long mapId, long corridorId, Long waypointId) {
    }

    public record DeleteCorridorDoorRequest(long mapId, long corridorId, GridSegment boundarySegment) {
    }
}
