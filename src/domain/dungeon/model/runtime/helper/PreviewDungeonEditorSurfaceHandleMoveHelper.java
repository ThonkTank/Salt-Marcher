package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceGeometry.EdgeKey;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Edge;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Handle;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.HandleRef;

public final class PreviewDungeonEditorSurfaceHandleMoveHelper {

    public List<Handle> movedClusterHandles(List<Handle> handles, long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        List<Handle> result = new ArrayList<>();
        for (Handle handle : handles) {
            result.add(handle.ref().clusterId() == clusterId
                    ? movedHandle(handle, deltaQ, deltaR, deltaLevel)
                    : handle);
        }
        return List.copyOf(result);
    }

    public List<Handle> movedCornerHandles(
            List<Handle> handles,
            HandleRef active,
            Cell source,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Handle> result = new ArrayList<>();
        for (Handle handle : handles) {
            result.add(movedCornerHandle(handle, active, source, deltaQ, deltaR, deltaLevel));
        }
        return List.copyOf(result);
    }

    public List<Handle> movedSourceEdgeHandles(
            List<Edge> sourceEdges,
            List<Handle> handles,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Set<EdgeKey> sourceEdgeKeys = DungeonEditorWorkspaceGeometry.unitEdgeKeys(sourceEdges);
        List<Handle> result = new ArrayList<>();
        for (Handle handle : handles) {
            Edge sourceEdge = handle.ref().sourceEdge();
            result.add(sourceEdge != null && sourceEdgeKeys.contains(EdgeKey.of(sourceEdge))
                    ? movedHandle(handle, deltaQ, deltaR, deltaLevel)
                    : handle);
        }
        return List.copyOf(result);
    }

    private static Handle movedCornerHandle(
            Handle handle,
            HandleRef active,
            Cell source,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        boolean sameHandle = sameHandleRef(handle.ref(), active);
        boolean touchesCorner =
                handle.ref().sourceEdge() != null
                        && DungeonEditorWorkspaceGeometry.edgeHasCell(handle.ref().sourceEdge(), source);
        if (!sameHandle && !touchesCorner) {
            return handle;
        }
        return touchesCorner
                ? handleWithSourceEdge(
                        handle,
                        DungeonEditorWorkspaceGeometry.movedMatchingCell(
                                handle.ref().sourceEdge(),
                                source,
                                deltaQ,
                                deltaR,
                                deltaLevel),
                        source,
                        sameHandle,
                        deltaQ,
                        deltaR,
                        deltaLevel)
                : movedHandle(handle, deltaQ, deltaR, deltaLevel);
    }

    private static Handle movedHandle(Handle handle, int deltaQ, int deltaR, int deltaLevel) {
        Edge sourceEdge = handle.ref().sourceEdge();
        return handleWithRef(
                handle,
                DungeonEditorWorkspaceGeometry.movedCell(handle.cell(), deltaQ, deltaR, deltaLevel),
                sourceEdge == null
                        ? null
                        : DungeonEditorWorkspaceGeometry.movedEdge(sourceEdge, deltaQ, deltaR, deltaLevel),
                movedEdges(handle.ref().sourceEdges(), deltaQ, deltaR, deltaLevel));
    }

    private static Handle handleWithSourceEdge(
            Handle handle,
            Edge sourceEdge,
            Cell source,
            boolean moveCell,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return handleWithRef(
                handle,
                moveCell
                        ? DungeonEditorWorkspaceGeometry.movedCell(handle.cell(), deltaQ, deltaR, deltaLevel)
                        : handle.cell(),
                sourceEdge,
                movedMatchingCellEdges(handle.ref().sourceEdges(), source, deltaQ, deltaR, deltaLevel));
    }

    private static Handle handleWithRef(
            Handle handle,
            Cell cell,
            @Nullable Edge sourceEdge,
            List<Edge> sourceEdges
    ) {
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
                        cell,
                        ref.direction(),
                        sourceEdge,
                        sourceEdges),
                handle.label(),
                cell);
    }

    private static List<Edge> movedEdges(List<Edge> edges, int deltaQ, int deltaR, int deltaLevel) {
        List<Edge> result = new ArrayList<>();
        for (Edge edge : edges) {
            result.add(DungeonEditorWorkspaceGeometry.movedEdge(edge, deltaQ, deltaR, deltaLevel));
        }
        return List.copyOf(result);
    }

    private static List<Edge> movedMatchingCellEdges(
            List<Edge> edges,
            Cell source,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Edge> result = new ArrayList<>();
        for (Edge edge : edges) {
            result.add(DungeonEditorWorkspaceGeometry.edgeHasCell(edge, source)
                    ? DungeonEditorWorkspaceGeometry.movedMatchingCell(edge, source, deltaQ, deltaR, deltaLevel)
                    : edge);
        }
        return List.copyOf(result);
    }

    private static boolean sameHandleRef(HandleRef first, HandleRef second) {
        return first.kind() == second.kind()
                && first.topologyRef().equals(second.topologyRef())
                && first.ownerId() == second.ownerId()
                && first.clusterId() == second.clusterId()
                && first.corridorId() == second.corridorId()
                && first.roomId() == second.roomId()
                && first.index() == second.index();
    }
}
