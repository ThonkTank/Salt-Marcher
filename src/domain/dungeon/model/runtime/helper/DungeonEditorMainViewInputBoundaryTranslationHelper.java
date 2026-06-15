package src.domain.dungeon.model.runtime.helper;

import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.HandleTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.HitTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.HitKind;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorMainViewPointerTarget;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorMainViewInputBoundaryTranslationHelper {
    private static final double VERTEX_SNAP_DISTANCE = 0.22;

    public PointerState resolvePointerState(
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
            case LABEL -> labelTarget(HitKind.LABEL, safeTarget, safeTarget.targetKind().clusterLabel());
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
                HandleTarget.empty(),
                BoundaryTarget.empty());
    }

    private static HitTarget labelTarget(HitKind kind, DungeonEditorMainViewPointerTarget target, boolean clusterHandle) {
        HandleTarget handleTarget = clusterHandle
                ? HandleTarget.clusterLabel(
                        target.topologyRef().kind().name(),
                        target.topologyRef().id(),
                        target.ownerId(),
                        target.clusterId())
                : HandleTarget.empty();
        return new HitTarget(
                kind,
                target.ownerId(),
                target.clusterId(),
                target.topologyRef().kind().name(),
                target.topologyRef().id(),
                target.labelKind(),
                handleTarget,
                BoundaryTarget.empty());
    }

    private static HitTarget handleTarget(DungeonEditorWorkspaceValues.HandleRef handleRef) {
        DungeonEditorWorkspaceValues.HandleRef safeHandle =
                handleRef == null ? DungeonEditorWorkspaceValues.HandleRef.empty() : handleRef;
        HandleTarget handleTarget = new HandleTarget(
                safeHandle.kind().name(),
                safeHandle.topologyRef().kind().name(),
                safeHandle.topologyRef().id(),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                toCellTarget(safeHandle.cell()),
                safeHandle.direction(),
                safeHandle.hasSourceEdge() ? safeHandle.sourceEdge() : null);
        return new HitTarget(
                HitKind.HANDLE,
                handleTarget.ownerId(),
                handleTarget.clusterId(),
                handleTarget.topologyRefKind(),
                handleTarget.topologyRefId(),
                DungeonEditorMainViewInteractionValues.EMPTY_KIND,
                handleTarget,
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
                HandleTarget.empty(),
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

    private static src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellTarget toCellTarget(
            DungeonEditorWorkspaceValues.Cell cell
    ) {
        DungeonEditorWorkspaceValues.Cell safeCell =
                cell == null ? DungeonEditorWorkspaceValues.Cell.empty() : cell;
        return new src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellTarget(
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
