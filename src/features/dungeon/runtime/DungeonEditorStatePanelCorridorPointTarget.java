package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.HandleTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.SourceEdgeTarget;

final class DungeonEditorStatePanelCorridorPointTarget {
    private static final String CORRIDOR_ANCHOR_LABEL = "Korridor-Anker";
    private static final String CORRIDOR_WAYPOINT_LABEL = "Korridor-Wegpunkt";

    private DungeonEditorStatePanelCorridorPointTarget() {
    }

    static HandleTarget from(DungeonEditorStateSnapshot.Selection selection) {
        DungeonEditorStateSnapshot.Selection safeSelection = selection == null
                ? DungeonEditorStateSnapshot.Selection.empty()
                : selection;
        DungeonEditorHandleRef handleRef = safeSelection.handleRef();
        if (handleRef == null || !isEditable(handleRef)) {
            return HandleTarget.empty();
        }
        return toRuntimeTarget(handleRef);
    }

    static String labelFor(HandleTarget handle) {
        HandleTarget safeHandle = handle == null ? HandleTarget.empty() : handle;
        return "CORRIDOR_WAYPOINT".equals(safeHandle.kind())
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

    private static HandleTarget toRuntimeTarget(DungeonEditorHandleRef handleRef) {
        boolean sourceEdgePresent = handleRef.sourceEdge() != null
                && handleRef.sourceEdge().from() != null
                && handleRef.sourceEdge().to() != null;
        return new HandleTarget(
                handleRef.kind().name(),
                handleRef.topologyRef().kind().name(),
                handleRef.topologyRef().id(),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                handleRef.cell().q(),
                handleRef.cell().r(),
                handleRef.cell().level(),
                handleRef.direction(),
                sourceEdgePresent,
                sourceEdgePresent ? handleRef.sourceEdge().from().q() : 0,
                sourceEdgePresent ? handleRef.sourceEdge().from().r() : 0,
                sourceEdgePresent ? handleRef.sourceEdge().from().level() : 0,
                sourceEdgePresent ? handleRef.sourceEdge().to().q() : 0,
                sourceEdgePresent ? handleRef.sourceEdge().to().r() : 0,
                sourceEdgePresent ? handleRef.sourceEdge().to().level() : 0,
                sourceEdges(handleRef));
    }

    private static List<SourceEdgeTarget> sourceEdges(DungeonEditorHandleRef handleRef) {
        return handleRef.sourceEdges().stream()
                .filter(DungeonEditorStatePanelCorridorPointTarget::sourceEdgePresent)
                .map(edge -> new SourceEdgeTarget(
                        true,
                        edge.from().q(),
                        edge.from().r(),
                        edge.from().level(),
                        edge.to().q(),
                        edge.to().r(),
                        edge.to().level()))
                .toList();
    }

    private static boolean sourceEdgePresent(DungeonEdgeRef edge) {
        return edge != null && edge.from() != null && edge.to() != null;
    }
}
