package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.HitKind;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.HitTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorMainViewInputBoundaryTranslationHelper {
    private static final String ROOM_KIND = "ROOM";
    private static final String CORRIDOR_KIND = "CORRIDOR";
    private static final String STAIR_KIND = "STAIR";
    private static final String TRANSITION_KIND = "TRANSITION";
    private static final double VERTEX_SNAP_DISTANCE = 0.22;

    PointerState resolvePointerState(
            double canvasX,
            double canvasY,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            boolean wallSingleClickMode,
            DungeonEditorRuntimePointerTarget target
    ) {
        int q = (int) Math.floor(canvasX);
        int r = (int) Math.floor(canvasY);
        HitTarget hitTarget = toHitTarget(target);
        BoundaryTarget boundaryTarget = hitTarget.boundaryTarget();
        BoundaryTarget effectiveBoundaryTarget = boundaryTarget.present()
                ? boundaryTarget
                : BoundaryTarget.empty();
        return new PointerState(
                q,
                r,
                level,
                primaryButtonDown,
                secondaryButtonDown,
                wallSingleClickMode,
                hitTarget,
                toVertexTarget(canvasX, canvasY, level),
                effectiveBoundaryTarget);
    }

    static DungeonEditorRuntimePointerTarget doorDeleteBoundaryTarget(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        DungeonEditorWorkspaceValues.HandleRef handle = toRuntimeHandleRef(safeTarget.handleRef());
        if (!safeTarget.isHandleTarget()
                || !DungeonEditorMainViewInteractionValues.handleKind(
                        handle,
                        DungeonEditorMainViewInteractionValues.DOOR_KIND)
                || !handle.hasSourceEdge()) {
            return safeTarget;
        }
        return DungeonEditorRuntimePointerTarget.boundary(new DungeonEditorRuntimePointerTarget.BoundaryTarget(
                DungeonEditorRuntimePointerTarget.BoundaryKind.DOOR,
                "",
                handle.ownerId(),
                DungeonEditorRuntimePointerTarget.TopologyKind.fromLegacy(handle.topologyRef().kind().name()),
                handle.topologyRef().id(),
                handle.sourceEdge().from().q(),
                handle.sourceEdge().from().r(),
                handle.sourceEdge().from().level(),
                handle.sourceEdge().to().q(),
                handle.sourceEdge().to().r(),
                handle.sourceEdge().to().level()));
    }

    @SuppressWarnings("PMD.CyclomaticComplexity")
    private static HitTarget toHitTarget(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget =
                target == null ? DungeonEditorRuntimePointerTarget.empty() : target;
        return switch (safeTarget.targetKind()) {
            case EMPTY, VERTEX -> HitTarget.empty();
            case CELL, MARKER, GRAPH_NODE -> authoredTarget(toHitKind(safeTarget), safeTarget);
            case LABEL -> authoredTarget(HitKind.LABEL, safeTarget);
            case HANDLE -> handleTarget(toRuntimeHandleRef(safeTarget.handleRef()));
            case BOUNDARY -> boundaryTarget(safeTarget.boundary());
        };
    }

    private static HitTarget authoredTarget(HitKind kind, DungeonEditorRuntimePointerTarget target) {
        return new HitTarget(
                kind,
                target.ownerId(),
                target.clusterId(),
                target.topologyKind().legacyName(),
                target.topologyId(),
                target.labelKind().legacyName(),
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                BoundaryTarget.empty());
    }

    private static HitTarget handleTarget(DungeonEditorWorkspaceValues.HandleRef handleRef) {
        DungeonEditorWorkspaceValues.HandleRef safeHandle =
                handleRef == null ? DungeonEditorWorkspaceValues.HandleRef.empty() : handleRef;
        return new HitTarget(
                HitKind.HANDLE,
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.topologyRef().kind().name(),
                safeHandle.topologyRef().id(),
                DungeonEditorMainViewInteractionValues.EMPTY_KIND,
                safeHandle,
                BoundaryTarget.empty());
    }

    private static HitTarget boundaryTarget(DungeonEditorRuntimePointerTarget.BoundaryTarget target) {
        DungeonEditorRuntimePointerTarget.BoundaryTarget safeTarget =
                target == null ? DungeonEditorRuntimePointerTarget.BoundaryTarget.empty() : target;
        String topologyKind = safeTarget.topologyKind().legacyName();
        BoundaryTarget boundaryTarget = new BoundaryTarget(
                safeTarget.ownerId() > 0L || !topologyKind.isBlank() || !safeTarget.key().isBlank(),
                safeTarget.boundaryKind().workspaceKind().name(),
                safeTarget.key(),
                safeTarget.ownerId(),
                0L,
                topologyKind,
                safeTarget.topologyId(),
                toCellTarget(safeTarget.startQ(), safeTarget.startR(), safeTarget.startLevel()),
                toCellTarget(safeTarget.endQ(), safeTarget.endR(), safeTarget.endLevel()));
        return new HitTarget(
                HitKind.BOUNDARY,
                boundaryTarget.ownerId(),
                boundaryTarget.clusterId(),
                boundaryTarget.topologyRefKind(),
                boundaryTarget.topologyRefId(),
                DungeonEditorMainViewInteractionValues.EMPTY_KIND,
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                boundaryTarget);
    }

    private static HitKind toHitKind(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        String elementKind = safeTarget.elementKind().legacyName();
        DungeonTopologyElementKind topologyElementKind = safeTarget.topologyElementKind();
        String hitKind = elementKind.isBlank() ? topologyElementKind.name() : elementKind;
        if (ROOM_KIND.equals(hitKind)) {
            return HitKind.ROOM;
        }
        if (CORRIDOR_KIND.equals(hitKind)) {
            return HitKind.CORRIDOR;
        }
        if (STAIR_KIND.equals(hitKind)) {
            return HitKind.STAIR;
        }
        if (TRANSITION_KIND.equals(hitKind)) {
            return HitKind.TRANSITION;
        }
        return HitKind.EMPTY;
    }

    private static src.features.dungeon.runtime.DungeonEditorInteractionValues.CellTarget toCellTarget(
            double q,
            double r,
            int level
    ) {
        DungeonEditorWorkspaceValues.Cell cell = DungeonEditorRuntimeInputValues.cell(q, r, level);
        return new src.features.dungeon.runtime.DungeonEditorInteractionValues.CellTarget(
                cell.q(),
                cell.r(),
                cell.level());
    }

    private static DungeonEditorWorkspaceValues.HandleRef toRuntimeHandleRef(DungeonEditorHandleRef handle) {
        DungeonEditorHandleRef safeHandle = handle == null
                ? DungeonEditorHandleRef.empty()
                : handle;
        DungeonCellRef cell = safeHandle.cell();
        DungeonEdgeRef primarySourceEdge = safeHandle.sourceEdge();
        DungeonEditorWorkspaceValues.Edge runtimeSourceEdge = primarySourceEdge == null
                || primarySourceEdge.from() == null
                || primarySourceEdge.to() == null
                ? null
                : new DungeonEditorWorkspaceValues.Edge(
                        new DungeonEditorWorkspaceValues.Cell(
                                primarySourceEdge.from().q(),
                                primarySourceEdge.from().r(),
                                primarySourceEdge.from().level()),
                        new DungeonEditorWorkspaceValues.Cell(
                                primarySourceEdge.to().q(),
                                primarySourceEdge.to().r(),
                                primarySourceEdge.to().level()));
        List<DungeonEditorWorkspaceValues.Edge> runtimeSourceEdges = safeHandle.sourceEdges().stream()
                .filter(edge -> edge != null && edge.from() != null && edge.to() != null)
                .map(edge -> new DungeonEditorWorkspaceValues.Edge(
                        new DungeonEditorWorkspaceValues.Cell(edge.from().q(), edge.from().r(), edge.from().level()),
                        new DungeonEditorWorkspaceValues.Cell(edge.to().q(), edge.to().r(), edge.to().level())))
                .toList();
        return new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorRuntimeEnumTranslator.handleType(safeHandle.kind().name()),
                DungeonEditorRuntimeInputValues.topologyRef(
                        safeHandle.topologyRef().kind().name(),
                        safeHandle.topologyRef().id()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level()),
                safeHandle.direction(),
                runtimeSourceEdge,
                runtimeSourceEdges);
    }

    private static VertexTarget toVertexTarget(double canvasX, double canvasY, int level) {
        int vertexQ = (int) Math.round(canvasX);
        int vertexR = (int) Math.round(canvasY);
        double distance = Math.hypot(canvasX - vertexQ, canvasY - vertexR);
        if (distance > VERTEX_SNAP_DISTANCE) {
            return VertexTarget.empty();
        }
        return new VertexTarget(true, vertexQ, vertexR, level);
    }
}
