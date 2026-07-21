package features.dungeon.application.editor;

import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.api.DungeonEditorHandleKind;
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
            features.dungeon.api.editor.DungeonEditorPointerInput.Target target
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

    static features.dungeon.api.editor.DungeonEditorPointerInput.Target doorDeleteBoundaryTarget(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        features.dungeon.api.editor.DungeonEditorPointerInput.Target safeTarget = target == null
                ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty()
                : target;
        DungeonEditorWorkspaceValues.HandleRef handle =
                DungeonEditorMainViewInteractionValues.handleRef(safeTarget.handleRef());
        if (!safeTarget.isHandleTarget()
                || !DungeonEditorMainViewInteractionValues.handleKind(
                        handle,
                        DungeonEditorHandleKind.DOOR)
                || !handle.hasSourceEdge()) {
            return safeTarget;
        }
        return features.dungeon.api.editor.DungeonEditorPointerInput.Target.boundary(new features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget(
                features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryKind.DOOR,
                "",
                handle.ownerId(),
                DungeonEditorMainViewInteractionValues.topologyKind(handle.topologyRef().kind()),
                handle.topologyRef().id(),
                handle.sourceEdge().from().q(),
                handle.sourceEdge().from().r(),
                handle.sourceEdge().from().level(),
                handle.sourceEdge().to().q(),
                handle.sourceEdge().to().r(),
                handle.sourceEdge().to().level()));
    }

    private static HitTarget toHitTarget(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        features.dungeon.api.editor.DungeonEditorPointerInput.Target safeTarget =
                target == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : target;
        return switch (safeTarget.targetKind()) {
            case EMPTY, VERTEX -> HitTarget.empty();
            case CELL, MARKER, GRAPH_NODE -> authoredTarget(toHitKind(safeTarget), safeTarget);
            case LABEL -> authoredTarget(HitKind.LABEL, safeTarget);
            case HANDLE -> handleTarget(DungeonEditorMainViewInteractionValues.handleRef(safeTarget.handleRef()));
            case BOUNDARY -> boundaryTarget(safeTarget.boundary());
        };
    }

    private static HitTarget authoredTarget(HitKind kind, features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
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
                DungeonEditorMainViewInteractionValues.topologyKind(safeHandle.topologyRef().kind()),
                safeHandle.topologyRef().id(),
                features.dungeon.api.editor.DungeonEditorPointerInput.LabelKind.defaultKind(),
                safeHandle,
                BoundaryTarget.empty());
    }

    private static HitTarget boundaryTarget(features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget target) {
        features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget safeTarget =
                target == null ? features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget.empty() : target;
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
                features.dungeon.api.editor.DungeonEditorPointerInput.LabelKind.defaultKind(),
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                boundaryTarget);
    }

    private static HitKind toHitKind(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        features.dungeon.api.editor.DungeonEditorPointerInput.Target safeTarget = target == null
                ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty()
                : target;
        return switch (safeTarget.elementKind()) {
            case ROOM -> HitKind.ROOM;
            case CORRIDOR, CORRIDOR_ANCHOR -> HitKind.CORRIDOR;
            case STAIR -> HitKind.STAIR;
            case TRANSITION -> HitKind.TRANSITION;
            case FEATURE_MARKER -> HitKind.FEATURE_MARKER;
            case EMPTY -> hitKindForTopology(DungeonEditorMainViewInteractionValues.topologyRef(
                    safeTarget.topologyKind(), safeTarget.topologyId()).kind());
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
        features.dungeon.domain.core.geometry.Cell cell = new features.dungeon.domain.core.geometry.Cell(
                (int) Math.round(q),
                (int) Math.round(r),
                level);
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
