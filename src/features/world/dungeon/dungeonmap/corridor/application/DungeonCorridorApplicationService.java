package features.world.dungeon.dungeonmap.corridor.application;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.dungeonmap.model.CorridorResolutionContextRequest;
import features.world.dungeon.dungeonmap.model.CorridorResolutionRequest;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.model.interaction.DungeonSelectionRef;

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
                        CorridorInputEditor.newDoorToDoorInput(layout.mapId(), resolvedRequest.levelZ(), resolvedRequest.start(), resolvedRequest.end())));
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
            throw new IllegalArgumentException("Door-to-boundary corridor attachment requires mapId, corridorId, door endpoint, and boundary");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                requiredExistingExteriorDoor(layout, corridor.levelZ(), resolvedRequest.doorRef());
                DungeonMap.CorridorBoundaryDescription boundary = layout.describeCorridorBoundary(
                        new DungeonSelectionRef.CorridorBoundaryRef(corridor.corridorId(), resolvedRequest.boundarySegment()),
                        corridor.levelZ());
                if (boundary == null) {
                    throw new IllegalArgumentException("Corridor attachment target must be a free corridor wall");
                }
                Long segmentId = corridor.segmentIdAtCell(boundary.corridorCell());
                CorridorInput updatedInput = CorridorInputEditor.attachDoor(
                        corridor.input(),
                        segmentId,
                        boundary.corridorCell(),
                        resolvedRequest.doorRef());
                saveUpdatedCorridor(conn, layout, corridor, updatedInput);
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
                Long segmentId = corridor.segmentIdAtCell(resolvedRequest.tileCell());
                CorridorInput inserted = CorridorInputEditor.insertNodeOnSegment(corridor.input(), segmentId, resolvedRequest.tileCell());
                Long nodeId = inserted.nodes().stream()
                        .filter(node -> node != null && !node.isDoorBound() && Objects.equals(node.fixedPoint(), resolvedRequest.tileCell()))
                        .map(features.world.dungeon.dungeonmap.corridor.model.CorridorInputNode::nodeId)
                        .findFirst()
                        .orElseThrow(() -> new IllegalArgumentException("Corridor tile is not on a routable corridor segment"));
                CorridorInput moved = CorridorInputEditor.moveNode(inserted, nodeId, resolvedRequest.targetPoint());
                saveUpdatedCorridor(conn, layout, corridor, moved);
            });
        }
    }

    public void moveNode(MoveCorridorNodeRequest request) throws SQLException {
        MoveCorridorNodeRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.corridorId() <= 0
                || resolvedRequest.nodeId() == null
                || resolvedRequest.point() == null) {
            throw new IllegalArgumentException("Corridor node move requires mapId, corridorId, nodeId, and point");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                saveUpdatedCorridor(conn, layout, corridor, CorridorInputEditor.moveNode(corridor.input(), resolvedRequest.nodeId(), resolvedRequest.point()));
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
                DungeonMap.DoorDescription targetDoor = requiredExistingExteriorDoor(layout, corridor.levelZ(), resolvedRequest.targetDoorRef());
                Long nodeId = corridor.doorNodeIdAtBoundary(
                        resolvedRequest.sourceBoundarySegment(),
                        layout.corridorResolutionInput(new CorridorResolutionContextRequest(corridor.levelZ())));
                if (nodeId == null) {
                    throw new IllegalArgumentException("Unknown corridor door boundary " + resolvedRequest.sourceBoundarySegment());
                }
                CorridorInput updatedInput = CorridorInputEditor.moveDoor(corridor.input(), nodeId, targetDoor.ref());
                saveUpdatedCorridor(conn, layout, corridor, updatedInput);
            });
        }
    }

    public void deleteSegment(DeleteCorridorSegmentRequest request) throws SQLException {
        DeleteCorridorSegmentRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.corridorId() <= 0 || resolvedRequest.segmentId() == null) {
            throw new IllegalArgumentException("Corridor segment delete requires mapId, corridorId, and segmentId");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                persistInputs(conn, layout, corridor, CorridorInputEditor.deleteSegment(corridor.input(), resolvedRequest.segmentId()));
            });
        }
    }

    public void deleteNode(DeleteCorridorNodeRequest request) throws SQLException {
        DeleteCorridorNodeRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.corridorId() <= 0 || resolvedRequest.nodeId() == null) {
            throw new IllegalArgumentException("Corridor node delete requires mapId, corridorId, and nodeId");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Corridor corridor = requireCorridor(layout, resolvedRequest.corridorId());
                persistInputs(conn, layout, corridor, CorridorInputEditor.deleteNode(corridor.input(), resolvedRequest.nodeId()));
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
                Long nodeId = corridor.doorNodeIdAtBoundary(
                        resolvedRequest.boundarySegment(),
                        layout.corridorResolutionInput(new CorridorResolutionContextRequest(corridor.levelZ())));
                if (nodeId == null) {
                    throw new IllegalArgumentException("Unknown corridor door boundary " + resolvedRequest.boundarySegment());
                }
                persistInputs(conn, layout, corridor, CorridorInputEditor.deleteNode(corridor.input(), nodeId));
            });
        }
    }

    private void saveUpdatedCorridor(
            Connection conn,
            DungeonMap layout,
            Corridor corridor,
            CorridorInput updatedInput
    ) throws SQLException {
        if (Objects.equals(updatedInput, corridor.input())) {
            return;
        }
        Corridor updatedCorridor = corridor.withInput(
                updatedInput,
                layout.corridorResolutionInput(new CorridorResolutionContextRequest(corridor.levelZ())));
        corridorRepository.save(conn, updatedCorridor, layout);
    }

    private void persistInputs(
            Connection conn,
            DungeonMap layout,
            Corridor originalCorridor,
            List<CorridorInput> inputs
    ) throws SQLException {
        if (conn == null || layout == null || originalCorridor == null || originalCorridor.corridorId() == null) {
            return;
        }
        if (inputs.isEmpty()) {
            corridorRepository.delete(conn, originalCorridor.corridorId());
            return;
        }
        DungeonMap workingLayout = layout;
        boolean first = true;
        for (CorridorInput componentInput : inputs) {
            CorridorInput persistedInput = first
                    ? new CorridorInput(
                    originalCorridor.corridorId(),
                    originalCorridor.structureObjectId(),
                    componentInput.mapId(),
                    componentInput.levelZ(),
                    componentInput.nodes(),
                    componentInput.segments())
                    : componentInput;
            Corridor resolved = workingLayout.resolveCorridor(new CorridorResolutionRequest(persistedInput));
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

    public record MoveCorridorNodeRequest(long mapId, long corridorId, Long nodeId, GridPoint point) {
    }

    public record MoveCorridorDoorRequest(
            long mapId,
            long corridorId,
            GridSegment sourceBoundarySegment,
            DoorRef targetDoorRef
    ) {
    }

    public record DeleteCorridorSegmentRequest(long mapId, long corridorId, Long segmentId) {
    }

    public record DeleteCorridorNodeRequest(long mapId, long corridorId, Long nodeId) {
    }

    public record DeleteCorridorDoorRequest(long mapId, long corridorId, GridSegment boundarySegment) {
    }
}
