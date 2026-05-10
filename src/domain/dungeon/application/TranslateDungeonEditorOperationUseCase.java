package src.domain.dungeon.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorAnchorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorDoorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;

public final class TranslateDungeonEditorOperationUseCase {

    private final TranslateDungeonAuthoredInputUseCase inputUseCase;
    private final DungeonOperationEndpointTranslator endpointTranslator;
    private final DungeonRoomNarrationTranslator narrationTranslator;

    public TranslateDungeonEditorOperationUseCase(TranslateDungeonAuthoredInputUseCase inputUseCase) {
        this.inputUseCase = inputUseCase;
        this.endpointTranslator = new DungeonOperationEndpointTranslator(inputUseCase);
        this.narrationTranslator = new DungeonRoomNarrationTranslator(inputUseCase);
    }

    public ApplyDungeonEditorOperationUseCase.OperationMutation operationMutation(
            @Nullable DungeonEditorOperation operation
    ) {
        return switch (operation) {
            case null -> ApplyDungeonEditorOperationUseCase.OperationMutation.identity();
            case DungeonEditorOperation.MoveTopologyElement moveTopologyElement -> {
                DungeonTopologyRef ref = inputUseCase.domainTopologyRef(moveTopologyElement.ref());
                yield current -> current.moveTopologyElement(
                        ref,
                        moveTopologyElement.deltaQ(),
                        moveTopologyElement.deltaR(),
                        moveTopologyElement.deltaLevel());
            }
            case DungeonEditorOperation.MoveEditorHandle moveEditorHandle -> {
                DungeonEditorHandle handle = inputUseCase.domainHandle(moveEditorHandle.ref());
                yield current -> current.moveEditorHandle(
                        handle,
                        moveEditorHandle.deltaQ(),
                        moveEditorHandle.deltaR(),
                        moveEditorHandle.deltaLevel());
            }
            case DungeonEditorOperation.MoveBoundaryStretch moveBoundaryStretch -> {
                List<DungeonEdge> sourceEdges =
                        moveBoundaryStretch.sourceEdges().stream().map(inputUseCase::domainEdge).toList();
                yield current -> current.moveBoundaryStretch(
                        moveBoundaryStretch.clusterId(),
                        sourceEdges,
                        moveBoundaryStretch.deltaQ(),
                        moveBoundaryStretch.deltaR(),
                        moveBoundaryStretch.deltaLevel());
            }
            case DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor ->
                    current -> current.moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
            case DungeonEditorOperation.PaintRoomRectangle paintRoomRectangle -> {
                DungeonCell start = inputUseCase.domainCell(paintRoomRectangle.start());
                DungeonCell end = inputUseCase.domainCell(paintRoomRectangle.end());
                yield current -> current.paintRoomRectangle(start, end);
            }
            case DungeonEditorOperation.DeleteRoomRectangle deleteRoomRectangle -> {
                DungeonCell start = inputUseCase.domainCell(deleteRoomRectangle.start());
                DungeonCell end = inputUseCase.domainCell(deleteRoomRectangle.end());
                yield current -> current.deleteRoomRectangle(start, end);
            }
            case DungeonEditorOperation.EditClusterBoundaries editClusterBoundaries -> {
                List<DungeonEdge> edges = editClusterBoundaries.edges().stream().map(inputUseCase::domainEdge).toList();
                DungeonClusterBoundaryKind kind = editClusterBoundaries.kind() == DungeonBoundaryKind.DOOR
                        ? DungeonClusterBoundaryKind.DOOR
                        : DungeonClusterBoundaryKind.WALL;
                yield current -> current.editClusterBoundaries(
                        editClusterBoundaries.clusterId(),
                        edges,
                        kind,
                        editClusterBoundaries.deleteBoundary());
            }
            case DungeonEditorOperation.CreateCorridor createCorridor -> {
                DungeonCorridorEndpoint start = endpointTranslator.corridorEndpoint(createCorridor.start());
                DungeonCorridorEndpoint end = endpointTranslator.corridorEndpoint(createCorridor.end());
                yield current -> current.createCorridor(start, end);
            }
            case DungeonEditorOperation.ExtendCorridor extendCorridor -> {
                DungeonCorridorRoomEndpoint endpoint = endpointTranslator.corridorRoomEndpoint(extendCorridor.endpoint());
                yield current -> current.extendCorridor(extendCorridor.corridorId(), endpoint);
            }
            case DungeonEditorOperation.MergeCorridors mergeCorridors ->
                    current -> current.mergeCorridors(mergeCorridors.corridorId(), mergeCorridors.mergedCorridorId());
            case DungeonEditorOperation.DeleteCorridor deleteCorridor ->
                    current -> current.deleteCorridor(deleteCorridor.corridorId());
            case DungeonEditorOperation.SaveRoomNarration saveRoomNarration ->
                    current -> current.saveRoomNarration(
                            saveRoomNarration.roomId(),
                            narrationTranslator.roomNarration(saveRoomNarration));
        };
    }
}

final class DungeonOperationEndpointTranslator {

    private final TranslateDungeonAuthoredInputUseCase inputUseCase;

    DungeonOperationEndpointTranslator(TranslateDungeonAuthoredInputUseCase inputUseCase) {
        this.inputUseCase = inputUseCase;
    }

    DungeonCorridorEndpoint corridorEndpoint(DungeonEditorOperation.CorridorEndpoint endpoint) {
        return switch (endpoint) {
            case DungeonEditorOperation.CorridorDoorEndpoint doorEndpoint -> new DungeonCorridorDoorEndpoint(
                    doorEndpoint.roomId(),
                    doorEndpoint.clusterId(),
                    inputUseCase.domainCell(doorEndpoint.roomCell()),
                    direction(doorEndpoint.direction()),
                    inputUseCase.domainTopologyRef(doorEndpoint.topologyRef()));
            case DungeonEditorOperation.CorridorAnchorEndpoint anchorEndpoint -> new DungeonCorridorAnchorEndpoint(
                    anchorEndpoint.hostCorridorId(),
                    inputUseCase.domainCell(anchorEndpoint.anchorCell()),
                    inputUseCase.domainTopologyRef(anchorEndpoint.topologyRef()));
            case null -> new DungeonCorridorDoorEndpoint(
                    0L,
                    0L,
                    inputUseCase.domainCell(null),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    DungeonCorridorRoomEndpoint corridorRoomEndpoint(DungeonEditorOperation.@Nullable CorridorRoomEndpoint endpoint) {
        if (endpoint == null) {
            return new DungeonCorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    inputUseCase.domainCell(null),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }
        return new DungeonCorridorRoomEndpoint(
                endpoint.roomId(),
                endpoint.clusterId(),
                endpoint.fixedDoor(),
                inputUseCase.domainCell(endpoint.roomCell()),
                direction(endpoint.direction()),
                inputUseCase.domainTopologyRef(endpoint.topologyRef()));
    }

    DungeonEdgeDirection direction(@Nullable String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }
}

final class DungeonRoomNarrationTranslator {

    private final TranslateDungeonAuthoredInputUseCase inputUseCase;

    DungeonRoomNarrationTranslator(TranslateDungeonAuthoredInputUseCase inputUseCase) {
        this.inputUseCase = inputUseCase;
    }

    DungeonRoomNarration roomNarration(DungeonEditorOperation.SaveRoomNarration saveRoomNarration) {
        return new DungeonRoomNarration(
                saveRoomNarration.visualDescription(),
                saveRoomNarration.exits().stream().map(this::exitNarration).toList());
    }

    DungeonRoomExitDescription exitNarration(DungeonInspectorSnapshot.RoomExitNarration exitNarration) {
        return new DungeonRoomExitDescription(
                inputUseCase.domainCell(exitNarration.cell()),
                DungeonEdgeDirection.parse(exitNarration.direction()),
                exitNarration.description());
    }
}
