package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Handle;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.HandleRef;

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
                                : movedEdge(ref.sourceEdge(), preview.deltaQ(), preview.deltaR(), preview.deltaLevel()),
                        movedEdges(ref.sourceEdges(), preview.deltaQ(), preview.deltaR(), preview.deltaLevel())),
                handle.label(),
                movedCell);
    }

    private List<Edge> movedEdges(List<Edge> edges, int deltaQ, int deltaR, int deltaLevel) {
        List<Edge> result = new ArrayList<>();
        for (Edge edge : edges) {
            result.add(movedEdge(edge, deltaQ, deltaR, deltaLevel));
        }
        return List.copyOf(result);
    }

    private static Cell movedCell(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        return new Cell(
                cell.q() + deltaQ,
                cell.r() + deltaR,
                cell.level() + deltaLevel);
    }
}
