package features.dungeon.application.editor;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorHandleRef;

final class DungeonEditorRuntimeInputValues {

    private DungeonEditorRuntimeInputValues() {
    }

    static features.dungeon.domain.core.geometry.Cell cell(double q, double r, int level) {
        return new features.dungeon.domain.core.geometry.Cell((int) Math.round(q), (int) Math.round(r), level);
    }

    static DungeonEditorWorkspaceValues.HandleRef handleRef(DungeonEditorHandleRef handle) {
        DungeonEditorHandleRef safeHandle = handle == null
                ? DungeonEditorHandleRef.empty()
                : handle;
        DungeonCellRef cell = safeHandle.cell();
        DungeonTopologyRef topologyRef = DungeonEditorRuntimePointerTarget.TopologyKind
                .fromPublished(safeHandle.topologyRef().kind())
                .ref(safeHandle.topologyRef().id());
        return new DungeonEditorWorkspaceValues.HandleRef(
                safeHandle.kind(),
                topologyRef,
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                new features.dungeon.domain.core.geometry.Cell(cell.q(), cell.r(), cell.level()),
                Direction.parse(safeHandle.direction()),
                edge(safeHandle.sourceEdge()),
                edges(safeHandle.sourceEdges()));
    }

    private static @Nullable Edge edge(
            @Nullable DungeonEdgeRef edge
    ) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        return new features.dungeon.domain.core.geometry.Edge(
                new features.dungeon.domain.core.geometry.Cell(edge.from().q(), edge.from().r(), edge.from().level()),
                new features.dungeon.domain.core.geometry.Cell(edge.to().q(), edge.to().r(), edge.to().level()));
    }

    private static List<features.dungeon.domain.core.geometry.Edge> edges(List<DungeonEdgeRef> edges) {
        return edges.stream()
                .map(DungeonEditorRuntimeInputValues::edge)
                .filter(Objects::nonNull)
                .toList();
    }
}
