package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorAnchorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorDoorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonTopologyRef;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    public sealed interface OperationInput permits
            OperationInput.MoveTopologyElement,
            OperationInput.MoveEditorHandle,
            OperationInput.MoveBoundaryStretch,
            OperationInput.MoveRoomAnchor,
            OperationInput.PaintRoomRectangle,
            OperationInput.DeleteRoomRectangle,
            OperationInput.EditClusterBoundaries,
            OperationInput.CreateCorridor,
            OperationInput.ExtendCorridor,
            OperationInput.MergeCorridors,
            OperationInput.DeleteCorridor,
            OperationInput.SaveRoomNarration,
            OperationInput.NoChange {

        record MoveTopologyElement(DungeonTopologyRef ref, int deltaQ, int deltaR, int deltaLevel)
                implements OperationInput {
        }

        record MoveEditorHandle(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel)
                implements OperationInput {
        }

        record MoveBoundaryStretch(
                long clusterId,
                List<DungeonEdge> sourceEdges,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) implements OperationInput {
            public MoveBoundaryStretch {
                clusterId = Math.max(0L, clusterId);
                sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            }
        }

        record MoveRoomAnchor(int deltaQ, int deltaR) implements OperationInput {
        }

        record PaintRoomRectangle(DungeonCell start, DungeonCell end) implements OperationInput {
        }

        record DeleteRoomRectangle(DungeonCell start, DungeonCell end) implements OperationInput {
        }

        record EditClusterBoundaries(
                long clusterId,
                List<DungeonEdge> edges,
                DungeonClusterBoundaryKind kind,
                boolean deleteBoundary
        ) implements OperationInput {
            public EditClusterBoundaries {
                clusterId = Math.max(0L, clusterId);
                edges = edges == null ? List.of() : List.copyOf(edges);
                kind = kind == null ? DungeonClusterBoundaryKind.WALL : kind;
            }
        }

        record CorridorRoomEndpoint(
                long roomId,
                long clusterId,
                boolean fixedDoor,
                DungeonCell roomCell,
                DungeonEdgeDirection direction,
                DungeonTopologyRef topologyRef
        ) {
            public CorridorRoomEndpoint {
                roomId = Math.max(0L, roomId);
                clusterId = Math.max(0L, clusterId);
                roomCell = roomCell == null ? new DungeonCell(0, 0, 0) : roomCell;
                direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
                topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            }
        }

        sealed interface CorridorEndpoint permits CorridorDoorEndpoint, CorridorAnchorEndpoint {
        }

        record CorridorDoorEndpoint(
                long roomId,
                long clusterId,
                DungeonCell roomCell,
                DungeonEdgeDirection direction,
                DungeonTopologyRef topologyRef
        ) implements CorridorEndpoint {
            public CorridorDoorEndpoint {
                roomId = Math.max(0L, roomId);
                clusterId = Math.max(0L, clusterId);
                roomCell = roomCell == null ? new DungeonCell(0, 0, 0) : roomCell;
                direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
                topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            }
        }

        record CorridorAnchorEndpoint(
                long hostCorridorId,
                DungeonCell anchorCell,
                DungeonTopologyRef topologyRef
        ) implements CorridorEndpoint {
            public CorridorAnchorEndpoint {
                hostCorridorId = Math.max(0L, hostCorridorId);
                anchorCell = anchorCell == null ? new DungeonCell(0, 0, 0) : anchorCell;
                topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            }
        }

        record CreateCorridor(
                CorridorEndpoint start,
                CorridorEndpoint end
        ) implements OperationInput {
            public CreateCorridor {
                start = start == null
                        ? new CorridorDoorEndpoint(
                        0L,
                        0L,
                        new DungeonCell(0, 0, 0),
                        DungeonEdgeDirection.NORTH,
                        DungeonTopologyRef.empty())
                        : start;
                end = end == null
                        ? new CorridorDoorEndpoint(
                        0L,
                        0L,
                        new DungeonCell(0, 0, 0),
                        DungeonEdgeDirection.NORTH,
                        DungeonTopologyRef.empty())
                        : end;
            }
        }

        record ExtendCorridor(
                long corridorId,
                CorridorRoomEndpoint endpoint
        ) implements OperationInput {
            public ExtendCorridor {
                corridorId = Math.max(0L, corridorId);
                endpoint = endpoint == null
                        ? new CorridorRoomEndpoint(
                        0L,
                        0L,
                        false,
                        new DungeonCell(0, 0, 0),
                        DungeonEdgeDirection.NORTH,
                        DungeonTopologyRef.empty())
                        : endpoint;
            }
        }

        record MergeCorridors(
                long corridorId,
                long mergedCorridorId
        ) implements OperationInput {
            public MergeCorridors {
                corridorId = Math.max(0L, corridorId);
                mergedCorridorId = Math.max(0L, mergedCorridorId);
            }
        }

        record DeleteCorridor(long corridorId) implements OperationInput {
            public DeleteCorridor {
                corridorId = Math.max(0L, corridorId);
            }
        }

        record SaveRoomNarration(
                long roomId,
                String visualDescription,
                List<DungeonRoomExitDescription> exits
        ) implements OperationInput {
            public SaveRoomNarration {
                visualDescription = visualDescription == null ? "" : visualDescription;
                exits = exits == null ? List.of() : List.copyOf(exits);
            }
        }

        record NoChange() implements OperationInput {
        }
    }

    public record OperationResultData(
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        public OperationResultData {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
        }
    }

    private final DungeonMapRepository repository;
    private final DungeonMapSearch search;
    private final BuildDungeonDerivedStateUseCase derive;

    public ApplyDungeonEditorOperationUseCase(
            DungeonMapRepository repository,
            DungeonMapSearch search,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.search = search;
        this.derive = derive;
    }

    public OperationResultData execute(OperationInput operation) {
        return execute(null, operation);
    }

    public OperationResultData execute(@Nullable DungeonMapIdentity mapId, OperationInput operation) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = apply(current, operation);
        List<String> validationMessages = mutated.validationMessages();
        List<String> reactionMessages = current.reactionMessages(mutated);
        DungeonDerivedState derived = derive.execute(mutated);
        DungeonMap saved = repository.save(mutated);
        var snapshot = snapshot(saved, derived);
        return new OperationResultData(snapshot, validationMessages, reactionMessages);
    }

    public OperationResultData preview(@Nullable DungeonMapIdentity mapId, OperationInput operation) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = apply(current, operation);
        DungeonDerivedState derived = derive.execute(mutated);
        return new OperationResultData(
                snapshot(mutated, derived),
                mutated.validationMessages(),
                current.reactionMessages(mutated));
    }

    private DungeonMap apply(DungeonMap current, OperationInput operation) {
        if (operation instanceof OperationInput.MoveTopologyElement moveTopologyElement) {
            return current.moveTopologyElement(
                    moveTopologyElement.ref(),
                    moveTopologyElement.deltaQ(),
                    moveTopologyElement.deltaR(),
                    moveTopologyElement.deltaLevel());
        }
        if (operation instanceof OperationInput.MoveEditorHandle moveEditorHandle) {
            return current.moveEditorHandle(
                    moveEditorHandle.handle(),
                    moveEditorHandle.deltaQ(),
                    moveEditorHandle.deltaR(),
                    moveEditorHandle.deltaLevel());
        }
        if (operation instanceof OperationInput.MoveBoundaryStretch moveBoundaryStretch) {
            return current.moveBoundaryStretch(
                    moveBoundaryStretch.clusterId(),
                    moveBoundaryStretch.sourceEdges(),
                    moveBoundaryStretch.deltaQ(),
                    moveBoundaryStretch.deltaR(),
                    moveBoundaryStretch.deltaLevel());
        }
        if (operation instanceof OperationInput.MoveRoomAnchor moveRoomAnchor) {
            return current.moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
        }
        if (operation instanceof OperationInput.PaintRoomRectangle paintRoomRectangle) {
            DungeonCell start = paintRoomRectangle.start();
            DungeonCell end = paintRoomRectangle.end();
            return start == null || end == null ? current : current.paintRoomRectangle(start, end);
        }
        if (operation instanceof OperationInput.DeleteRoomRectangle deleteRoomRectangle) {
            DungeonCell start = deleteRoomRectangle.start();
            DungeonCell end = deleteRoomRectangle.end();
            return start == null || end == null ? current : current.deleteRoomRectangle(start, end);
        }
        if (operation instanceof OperationInput.EditClusterBoundaries editClusterBoundaries) {
            return current.editClusterBoundaries(
                    editClusterBoundaries.clusterId(),
                    editClusterBoundaries.edges(),
                    editClusterBoundaries.kind(),
                    editClusterBoundaries.deleteBoundary());
        }
        if (operation instanceof OperationInput.CreateCorridor createCorridor) {
            return current.createCorridor(
                    toDomainEndpoint(createCorridor.start()),
                    toDomainEndpoint(createCorridor.end()));
        }
        if (operation instanceof OperationInput.ExtendCorridor extendCorridor) {
            return current.extendCorridor(extendCorridor.corridorId(), toDomainEndpoint(extendCorridor.endpoint()));
        }
        if (operation instanceof OperationInput.MergeCorridors mergeCorridors) {
            return current.mergeCorridors(mergeCorridors.corridorId(), mergeCorridors.mergedCorridorId());
        }
        if (operation instanceof OperationInput.DeleteCorridor deleteCorridor) {
            return current.deleteCorridor(deleteCorridor.corridorId());
        }
        if (operation instanceof OperationInput.SaveRoomNarration saveRoomNarration) {
            return current.saveRoomNarration(
                    saveRoomNarration.roomId(),
                    new DungeonRoomNarration(
                            saveRoomNarration.visualDescription(),
                            saveRoomNarration.exits()));
        }
        return current;
    }

    private static DungeonCorridorRoomEndpoint toDomainEndpoint(OperationInput.CorridorRoomEndpoint endpoint) {
        if (endpoint == null) {
            return new DungeonCorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    new DungeonCell(0, 0, 0),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }
        return new DungeonCorridorRoomEndpoint(
                endpoint.roomId(),
                endpoint.clusterId(),
                endpoint.fixedDoor(),
                endpoint.roomCell(),
                endpoint.direction(),
                endpoint.topologyRef());
    }

    private static DungeonCorridorEndpoint toDomainEndpoint(OperationInput.CorridorEndpoint endpoint) {
        if (endpoint instanceof OperationInput.CorridorDoorEndpoint doorEndpoint) {
            return new DungeonCorridorDoorEndpoint(
                    doorEndpoint.roomId(),
                    doorEndpoint.clusterId(),
                    doorEndpoint.roomCell(),
                    doorEndpoint.direction(),
                    doorEndpoint.topologyRef());
        }
        if (endpoint instanceof OperationInput.CorridorAnchorEndpoint anchorEndpoint) {
            return new DungeonCorridorAnchorEndpoint(
                    anchorEndpoint.hostCorridorId(),
                    anchorEndpoint.anchorCell(),
                    anchorEndpoint.topologyRef());
        }
        return new DungeonCorridorDoorEndpoint(
                0L,
                0L,
                new DungeonCell(0, 0, 0),
                DungeonEdgeDirection.NORTH,
                DungeonTopologyRef.empty());
    }

    private LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot(DungeonMap dungeonMap, DungeonDerivedState derived) {
        return new LoadDungeonSnapshotUseCase.DungeonSnapshotData(
                dungeonMap.metadata().mapName(),
                derived,
                LoadDungeonSnapshotUseCase.editorHandles(dungeonMap),
                dungeonMap.revision());
    }

    private DungeonMap currentMap(@Nullable DungeonMapIdentity mapId) {
        Optional<DungeonMap> selectedMap = mapId == null ? Optional.empty() : repository.findById(mapId);
        return selectedMap.or(() -> search.firstMap())
                .orElseGet(ApplyDungeonEditorOperationUseCase::emptyFallbackMap);
    }

    private static DungeonMap emptyFallbackMap() {
        return DungeonMap.empty(new DungeonMapIdentity(1L), "Dungeon Map");
    }
}
