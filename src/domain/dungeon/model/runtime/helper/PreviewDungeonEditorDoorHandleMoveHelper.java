package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Edge;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Handle;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.HandleRef;

public final class PreviewDungeonEditorDoorHandleMoveHelper {

    public List<Handle> movedHandles(
            List<Handle> source,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        List<Handle> result = new ArrayList<>();
        for (Handle handle : source) {
            result.add(handle.ref().equals(preview.handleRef())
                    ? movedHandle(handle, preview)
                    : handle);
        }
        return List.copyOf(result);
    }

    public Edge movedEdge(Edge edge, int deltaQ, int deltaR, int deltaLevel) {
        return new Edge(
                movedCell(edge.from(), deltaQ, deltaR, deltaLevel),
                movedCell(edge.to(), deltaQ, deltaR, deltaLevel));
    }

    private Handle movedHandle(Handle handle, DungeonEditorSessionValues.MoveHandlePreview preview) {
        Cell movedCell = movedCell(handle.cell(), preview.deltaQ(), preview.deltaR(), preview.deltaLevel());
        HandleRef ref = handle.ref();
        return new Handle(
                new HandleRef(
                        ref.kind(),
                        ref.topologyRef(),
                        ref.ownerId(),
                        ref.clusterId(),
                        ref.corridorId(),
                        ref.roomId(),
                        ref.index(),
                        movedCell,
                        ref.direction(),
                        ref.sourceEdge() == null
                                ? null
                                : movedEdge(ref.sourceEdge(), preview.deltaQ(), preview.deltaR(), preview.deltaLevel())),
                handle.label(),
                movedCell);
    }

    private static Cell movedCell(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        return new Cell(
                cell.q() + deltaQ,
                cell.r() + deltaR,
                cell.level() + deltaLevel);
    }
}
