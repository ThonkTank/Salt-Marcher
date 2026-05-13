package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapTopologyOps;
import src.domain.dungeon.published.DungeonEditorOperation;

final class DungeonEditorOperationTopologyMutationUseCase {

    private DungeonEditorOperationTopologyMutationUseCase() {
    }

    static @Nullable DungeonMap apply(DungeonMap current, DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.MoveTopologyElement move) {
            return DungeonMapTopologyOps.moveTopologyElement(
                    current,
                    DungeonEditorOperationRefsUseCase.topologyRef(move.ref()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
        }
        if (operation instanceof DungeonEditorOperation.MoveEditorHandle move) {
            return DungeonMapTopologyOps.moveEditorHandle(
                    current,
                    DungeonEditorOperationHandlesUseCase.handle(move.ref()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
        }
        if (operation instanceof DungeonEditorOperation.MoveBoundaryStretch move) {
            return DungeonMapTopologyOps.moveBoundaryStretch(
                    current,
                    move.clusterId(),
                    move.sourceEdges().stream().map(DungeonEditorOperationRefsUseCase::edge).toList(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
        }
        if (operation instanceof DungeonEditorOperation.MoveRoomAnchor move) {
            return DungeonMapTopologyOps.moveRoomAnchor(current, move.deltaQ(), move.deltaR());
        }
        if (operation instanceof DungeonEditorOperation.RoomRectangle rectangle) {
            return rectangle.action().deletesRoomCells()
                    ? DungeonMapTopologyOps.deleteRoomRectangle(
                    current,
                    DungeonEditorOperationRefsUseCase.cell(rectangle.start()),
                    DungeonEditorOperationRefsUseCase.cell(rectangle.end()))
                    : DungeonMapTopologyOps.paintRoomRectangle(
                    current,
                    DungeonEditorOperationRefsUseCase.cell(rectangle.start()),
                    DungeonEditorOperationRefsUseCase.cell(rectangle.end()));
        }
        if (operation instanceof DungeonEditorOperation.EditClusterBoundaries edit) {
            return DungeonMapTopologyOps.editClusterBoundaries(
                    current,
                    edit.clusterId(),
                    edit.edges().stream().map(DungeonEditorOperationRefsUseCase::edge).toList(),
                    DungeonEditorOperationBoundaryKindUseCase.kind(edit.kind()),
                    edit.deleteBoundary());
        }
        return null;
    }
}
