package src.domain.dungeon.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonMapCorridorOps;
import src.domain.dungeon.model.map.model.DungeonMapTopologyOps;
import src.domain.dungeon.model.map.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
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
                yield current -> DungeonMapTopologyOps.moveTopologyElement(
                        current,
                        ref,
                        moveTopologyElement.deltaQ(),
                        moveTopologyElement.deltaR(),
                        moveTopologyElement.deltaLevel());
            }
            case DungeonEditorOperation.MoveEditorHandle moveEditorHandle -> {
                DungeonEditorHandle handle = inputUseCase.domainHandle(moveEditorHandle.ref());
                yield current -> DungeonMapTopologyOps.moveEditorHandle(
                        current,
                        handle,
                        moveEditorHandle.deltaQ(),
                        moveEditorHandle.deltaR(),
                        moveEditorHandle.deltaLevel());
            }
            case DungeonEditorOperation.MoveBoundaryStretch moveBoundaryStretch -> {
                List<DungeonEdge> sourceEdges =
                        moveBoundaryStretch.sourceEdges().stream().map(inputUseCase::domainEdge).toList();
                yield current -> DungeonMapTopologyOps.moveBoundaryStretch(
                        current,
                        moveBoundaryStretch.clusterId(),
                        sourceEdges,
                        moveBoundaryStretch.deltaQ(),
                        moveBoundaryStretch.deltaR(),
                        moveBoundaryStretch.deltaLevel());
            }
            case DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor ->
                    current -> DungeonMapTopologyOps.moveRoomAnchor(current, moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
            case DungeonEditorOperation.RoomRectangle roomRectangle -> {
                DungeonCell start = inputUseCase.domainCell(roomRectangle.start());
                DungeonCell end = inputUseCase.domainCell(roomRectangle.end());
                yield roomRectangle.action().deletesRoomCells()
                        ? current -> DungeonMapTopologyOps.deleteRoomRectangle(current, start, end)
                        : current -> DungeonMapTopologyOps.paintRoomRectangle(current, start, end);
            }
            case DungeonEditorOperation.EditClusterBoundaries editClusterBoundaries -> {
                List<DungeonEdge> edges = editClusterBoundaries.edges().stream().map(inputUseCase::domainEdge).toList();
                DungeonClusterBoundaryKind kind = editClusterBoundaries.kind() == DungeonBoundaryKind.DOOR
                        ? DungeonClusterBoundaryKind.DOOR
                        : DungeonClusterBoundaryKind.WALL;
                yield current -> DungeonMapTopologyOps.editClusterBoundaries(
                        current,
                        editClusterBoundaries.clusterId(),
                        edges,
                        kind,
                        editClusterBoundaries.deleteBoundary());
            }
            case DungeonEditorOperation.CreateCorridor createCorridor -> {
                DungeonCorridorEndpoint start = endpointTranslator.corridorEndpoint(createCorridor.start());
                DungeonCorridorEndpoint end = endpointTranslator.corridorEndpoint(createCorridor.end());
                yield current -> DungeonMapCorridorOps.createCorridor(current, start, end);
            }
            case DungeonEditorOperation.ExtendCorridor extendCorridor -> {
                DungeonCorridorRoomEndpoint endpoint = endpointTranslator.corridorRoomEndpoint(extendCorridor.endpoint());
                yield current -> DungeonMapCorridorOps.extendCorridor(current, extendCorridor.corridorId(), endpoint);
            }
            case DungeonEditorOperation.MergeCorridors mergeCorridors ->
                    current -> DungeonMapCorridorOps.mergeCorridors(
                            current,
                            mergeCorridors.corridorId(),
                            mergeCorridors.mergedCorridorId());
            case DungeonEditorOperation.DeleteCorridor deleteCorridor ->
                    current -> DungeonMapCorridorOps.deleteCorridor(current, deleteCorridor.corridorId());
            case DungeonEditorOperation.SaveRoomNarration saveRoomNarration ->
                    current -> DungeonMapTopologyOps.saveRoomNarration(
                            current,
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
            case DungeonEditorOperation.CorridorDoorEndpoint doorEndpoint -> DungeonCorridorEndpoint.door(
                    doorEndpoint.roomId(),
                    doorEndpoint.clusterId(),
                    inputUseCase.domainCell(doorEndpoint.roomCell()),
                    direction(doorEndpoint.direction()),
                    inputUseCase.domainTopologyRef(doorEndpoint.topologyRef()));
            case DungeonEditorOperation.CorridorAnchorEndpoint anchorEndpoint -> DungeonCorridorEndpoint.anchor(
                    anchorEndpoint.hostCorridorId(),
                    inputUseCase.domainCell(anchorEndpoint.anchorCell()),
                    inputUseCase.domainTopologyRef(anchorEndpoint.topologyRef()));
            case null -> DungeonCorridorEndpoint.door(
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
