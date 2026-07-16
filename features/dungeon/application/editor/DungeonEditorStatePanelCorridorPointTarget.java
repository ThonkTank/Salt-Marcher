package features.dungeon.application.editor;

import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.application.editor.interaction.DungeonEditorHandleType;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.DungeonTopologyElementKind;

final class DungeonEditorStatePanelCorridorPointTarget {
    private static final String CORRIDOR_ANCHOR_LABEL = "Korridor-Anker";
    private static final String CORRIDOR_WAYPOINT_LABEL = "Korridor-Wegpunkt";

    private DungeonEditorStatePanelCorridorPointTarget() {
    }

    static DungeonEditorWorkspaceValues.HandleRef from(DungeonEditorStateSnapshot.Selection selection) {
        DungeonEditorStateSnapshot.Selection safeSelection = selection == null
                ? DungeonEditorStateSnapshot.Selection.empty()
                : selection;
        DungeonEditorHandleRef handleRef = safeSelection.handleRef();
        if (handleRef == null || !isEditable(handleRef)) {
            return DungeonEditorWorkspaceValues.HandleRef.empty();
        }
        return toWorkspaceHandleRef(handleRef);
    }

    static String labelFor(DungeonEditorWorkspaceValues.HandleRef handle) {
        DungeonEditorWorkspaceValues.HandleRef safeHandle = handle == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : handle;
        return DungeonEditorHandleType.CORRIDOR_WAYPOINT == safeHandle.kind()
                ? CORRIDOR_WAYPOINT_LABEL
                : CORRIDOR_ANCHOR_LABEL;
    }

    private static boolean isEditable(DungeonEditorHandleRef handleRef) {
        DungeonEditorHandleKind kind = handleRef.kind();
        DungeonTopologyElementKind topologyKind = handleRef.topologyRef().kind();
        return (kind == DungeonEditorHandleKind.CORRIDOR_ANCHOR
                || kind == DungeonEditorHandleKind.CORRIDOR_WAYPOINT)
                && (topologyKind == DungeonTopologyElementKind.CORRIDOR
                        || topologyKind == DungeonTopologyElementKind.CORRIDOR_ANCHOR);
    }

    private static DungeonEditorWorkspaceValues.HandleRef toWorkspaceHandleRef(DungeonEditorHandleRef handleRef) {
        return new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorRuntimeEnumTranslator.handleType(handleRef.kind().name()),
                new DungeonTopologyRef(
                        DungeonEditorMainViewInteractionValues.toTopologyKind(handleRef.topologyRef().kind().name()),
                        handleRef.topologyRef().id()),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                cell(handleRef.cell()),
                handleRef.direction(),
                sourceEdge(handleRef.sourceEdge()),
                sourceEdges(handleRef));
    }

    private static DungeonEditorWorkspaceValues.Cell cell(DungeonCellRef cell) {
        DungeonCellRef safeCell = cell == null ? new DungeonCellRef(0, 0, 0) : cell;
        return new DungeonEditorWorkspaceValues.Cell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonEditorWorkspaceValues.Edge sourceEdge(DungeonEdgeRef edge) {
        return sourceEdgePresent(edge)
                ? new DungeonEditorWorkspaceValues.Edge(cell(edge.from()), cell(edge.to()))
                : null;
    }

    private static java.util.List<DungeonEditorWorkspaceValues.Edge> sourceEdges(DungeonEditorHandleRef handleRef) {
        return handleRef.sourceEdges().stream()
                .filter(DungeonEditorStatePanelCorridorPointTarget::sourceEdgePresent)
                .map(edge -> new DungeonEditorWorkspaceValues.Edge(cell(edge.from()), cell(edge.to())))
                .toList();
    }

    private static boolean sourceEdgePresent(DungeonEdgeRef edge) {
        return edge != null && edge.from() != null && edge.to() != null;
    }
}
