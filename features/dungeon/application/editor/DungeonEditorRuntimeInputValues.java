package features.dungeon.application.editor;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorHandleRef;

final class DungeonEditorRuntimeInputValues {

    private DungeonEditorRuntimeInputValues() {
    }

    static DungeonEditorWorkspaceValues.Cell cell(double q, double r, int level) {
        return new DungeonEditorWorkspaceValues.Cell((int) Math.round(q), (int) Math.round(r), level);
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
                DungeonEditorRuntimeEnumTranslator.handleType(safeHandle.kind().name()),
                topologyRef,
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level()),
                safeHandle.direction(),
                edge(safeHandle.sourceEdge()),
                edges(safeHandle.sourceEdges()));
    }

    private static DungeonEditorWorkspaceValues.@Nullable Edge edge(
            @Nullable DungeonEdgeRef edge
    ) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        return new DungeonEditorWorkspaceValues.Edge(
                new DungeonEditorWorkspaceValues.Cell(edge.from().q(), edge.from().r(), edge.from().level()),
                new DungeonEditorWorkspaceValues.Cell(edge.to().q(), edge.to().r(), edge.to().level()));
    }

    private static List<DungeonEditorWorkspaceValues.Edge> edges(List<DungeonEdgeRef> edges) {
        return edges.stream()
                .map(DungeonEditorRuntimeInputValues::edge)
                .filter(Objects::nonNull)
                .toList();
    }
}
