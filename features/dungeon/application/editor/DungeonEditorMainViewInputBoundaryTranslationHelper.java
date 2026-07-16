package features.dungeon.application.editor;

import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.application.editor.interaction.DungeonEditorHandleType;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.HitKind;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.HitTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorMainViewInputBoundaryTranslationHelper {
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
        DungeonEditorWorkspaceValues.HandleRef handle =
                DungeonEditorRuntimeInputValues.handleRef(safeTarget.handleRef());
        if (!safeTarget.isHandleTarget()
                || !DungeonEditorMainViewInteractionValues.handleKind(
                        handle,
                        DungeonEditorHandleType.DOOR)
                || !handle.hasSourceEdge()) {
            return safeTarget;
        }
        return DungeonEditorRuntimePointerTarget.boundary(new DungeonEditorRuntimePointerTarget.BoundaryTarget(
                DungeonEditorRuntimePointerTarget.BoundaryKind.DOOR,
                "",
                handle.ownerId(),
                DungeonEditorRuntimePointerTarget.TopologyKind.fromDomain(handle.topologyRef().kind()),
                handle.topologyRef().id(),
                handle.sourceEdge().from().q(),
                handle.sourceEdge().from().r(),
                handle.sourceEdge().from().level(),
                handle.sourceEdge().to().q(),
                handle.sourceEdge().to().r(),
                handle.sourceEdge().to().level()));
    }

    private static HitTarget toHitTarget(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget =
                target == null ? DungeonEditorRuntimePointerTarget.empty() : target;
        return switch (safeTarget.targetKind()) {
            case EMPTY, VERTEX -> HitTarget.empty();
            case CELL, MARKER, GRAPH_NODE -> authoredTarget(toHitKind(safeTarget), safeTarget);
            case LABEL -> authoredTarget(HitKind.LABEL, safeTarget);
            case HANDLE -> handleTarget(DungeonEditorRuntimeInputValues.handleRef(safeTarget.handleRef()));
            case BOUNDARY -> boundaryTarget(safeTarget.boundary());
        };
    }

    private static HitTarget authoredTarget(HitKind kind, DungeonEditorRuntimePointerTarget target) {
        return new HitTarget(
                kind,
                target.ownerId(),
                target.clusterId(),
                target.topologyKind(),
                target.topologyId(),
                target.labelKind(),
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
                DungeonEditorRuntimePointerTarget.TopologyKind.fromDomain(safeHandle.topologyRef().kind()),
                safeHandle.topologyRef().id(),
                DungeonEditorRuntimePointerTarget.LabelKind.defaultKind(),
                safeHandle,
                BoundaryTarget.empty());
    }

    private static HitTarget boundaryTarget(DungeonEditorRuntimePointerTarget.BoundaryTarget target) {
        DungeonEditorRuntimePointerTarget.BoundaryTarget safeTarget =
                target == null ? DungeonEditorRuntimePointerTarget.BoundaryTarget.empty() : target;
        BoundaryTarget boundaryTarget = new BoundaryTarget(
                safeTarget.ownerId() > 0L
                        || !safeTarget.topologyKind().isEmpty()
                        || !safeTarget.key().isBlank(),
                safeTarget.boundaryKind(),
                safeTarget.key(),
                safeTarget.ownerId(),
                0L,
                safeTarget.topologyKind(),
                safeTarget.topologyId(),
                toCellTarget(safeTarget.startQ(), safeTarget.startR(), safeTarget.startLevel()),
                toCellTarget(safeTarget.endQ(), safeTarget.endR(), safeTarget.endLevel()));
        return new HitTarget(
                HitKind.BOUNDARY,
                boundaryTarget.ownerId(),
                boundaryTarget.clusterId(),
                boundaryTarget.topologyKind(),
                boundaryTarget.topologyRefId(),
                DungeonEditorRuntimePointerTarget.LabelKind.defaultKind(),
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                boundaryTarget);
    }

    private static HitKind toHitKind(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        return switch (safeTarget.elementKind()) {
            case ROOM -> HitKind.ROOM;
            case CORRIDOR, CORRIDOR_ANCHOR -> HitKind.CORRIDOR;
            case STAIR -> HitKind.STAIR;
            case TRANSITION -> HitKind.TRANSITION;
            case FEATURE_MARKER -> HitKind.FEATURE_MARKER;
            case EMPTY -> hitKindForTopology(safeTarget.topologyElementKind());
            default -> HitKind.EMPTY;
        };
    }

    private static HitKind hitKindForTopology(DungeonTopologyElementKind topologyElementKind) {
        if (topologyElementKind == DungeonTopologyElementKind.ROOM) {
            return HitKind.ROOM;
        }
        if (topologyElementKind == DungeonTopologyElementKind.CORRIDOR
                || topologyElementKind == DungeonTopologyElementKind.CORRIDOR_ANCHOR) {
            return HitKind.CORRIDOR;
        }
        if (topologyElementKind == DungeonTopologyElementKind.STAIR) {
            return HitKind.STAIR;
        }
        if (topologyElementKind == DungeonTopologyElementKind.TRANSITION) {
            return HitKind.TRANSITION;
        }
        if (topologyElementKind == DungeonTopologyElementKind.FEATURE_MARKER) {
            return HitKind.FEATURE_MARKER;
        }
        return HitKind.EMPTY;
    }

    private static features.dungeon.application.editor.DungeonEditorInteractionValues.CellTarget toCellTarget(
            double q,
            double r,
            int level
    ) {
        DungeonEditorWorkspaceValues.Cell cell = DungeonEditorRuntimeInputValues.cell(q, r, level);
        return new features.dungeon.application.editor.DungeonEditorInteractionValues.CellTarget(
                cell.q(),
                cell.r(),
                cell.level());
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
