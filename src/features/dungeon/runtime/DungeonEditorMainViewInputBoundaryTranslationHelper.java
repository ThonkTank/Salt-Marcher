package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.HitKind;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.HitTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorMainViewInputBoundaryTranslationHelper {
    private static final double VERTEX_SNAP_DISTANCE = 0.22;

    PointerState resolvePointerState(
            double canvasX,
            double canvasY,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            boolean wallSingleClickMode,
            DungeonEditorMainViewPointerTarget target
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

    private static HitTarget toHitTarget(DungeonEditorMainViewPointerTarget target) {
        DungeonEditorMainViewPointerTarget safeTarget =
                target == null ? DungeonEditorMainViewPointerTarget.empty() : target;
        return switch (safeTarget.targetKind().category()) {
            case EMPTY -> HitTarget.empty();
            case SIMPLE -> simpleTarget(toHitKind(safeTarget.elementKind()), safeTarget);
            case LABEL -> labelTarget(HitKind.LABEL, safeTarget);
            case HANDLE -> handleTarget(safeTarget.handleRef());
            case BOUNDARY -> boundaryTarget(safeTarget);
        };
    }

    private static HitTarget simpleTarget(HitKind kind, DungeonEditorMainViewPointerTarget target) {
        return new HitTarget(
                kind,
                target.ownerId(),
                target.clusterId(),
                target.topologyRef().kind().name(),
                target.topologyRef().id(),
                target.labelKind(),
                DungeonEditorWorkspaceValues.HandleRef.empty(),
                BoundaryTarget.empty());
    }

    private static HitTarget labelTarget(HitKind kind, DungeonEditorMainViewPointerTarget target) {
        return new HitTarget(
                kind,
                target.ownerId(),
                target.clusterId(),
                target.topologyRef().kind().name(),
                target.topologyRef().id(),
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
                safeHandle.topologyRef().kind().name(),
                safeHandle.topologyRef().id(),
                DungeonEditorMainViewInteractionValues.EMPTY_KIND,
                safeHandle,
                BoundaryTarget.empty());
    }

    private static HitTarget boundaryTarget(DungeonEditorMainViewPointerTarget target) {
        DungeonEditorMainViewPointerTarget safeTarget =
                target == null ? DungeonEditorMainViewPointerTarget.empty() : target;
        BoundaryTarget boundaryTarget = new BoundaryTarget(
                safeTarget.boundaryPresent(),
                safeTarget.boundaryKind().name(),
                safeTarget.boundaryKey(),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                safeTarget.topologyRef().kind().name(),
                safeTarget.topologyRef().id(),
                toCellTarget(safeTarget.boundaryStart()),
                toCellTarget(safeTarget.boundaryEnd()));
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

    private static HitKind toHitKind(DungeonTopologyElementKind kind) {
        DungeonTopologyElementKind safeKind = kind == null ? DungeonTopologyElementKind.EMPTY : kind;
        if (safeKind == DungeonTopologyElementKind.ROOM) {
            return HitKind.ROOM;
        }
        if (safeKind == DungeonTopologyElementKind.CORRIDOR) {
            return HitKind.CORRIDOR;
        }
        if (safeKind == DungeonTopologyElementKind.STAIR) {
            return HitKind.STAIR;
        }
        if (safeKind == DungeonTopologyElementKind.TRANSITION) {
            return HitKind.TRANSITION;
        }
        return HitKind.EMPTY;
    }

    private static src.features.dungeon.runtime.DungeonEditorInteractionValues.CellTarget toCellTarget(
            DungeonEditorWorkspaceValues.Cell cell
    ) {
        DungeonEditorWorkspaceValues.Cell safeCell =
                cell == null ? DungeonEditorWorkspaceValues.Cell.empty() : cell;
        return new src.features.dungeon.runtime.DungeonEditorInteractionValues.CellTarget(
                safeCell.q(),
                safeCell.r(),
                safeCell.level());
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
