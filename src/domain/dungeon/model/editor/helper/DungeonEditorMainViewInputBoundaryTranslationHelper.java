package src.domain.dungeon.model.editor.helper;

import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.HandleTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitKind;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewPointerTarget;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;

public final class DungeonEditorMainViewInputBoundaryTranslationHelper {
    private static final double VERTEX_SNAP_DISTANCE = 0.22;

    public PointerState resolvePointerState(
            double canvasX,
            double canvasY,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
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
                hitTarget,
                toVertexTarget(canvasX, canvasY, level),
                effectiveBoundaryTarget);
    }

    private static HitTarget toHitTarget(DungeonEditorMainViewPointerTarget target) {
        DungeonEditorMainViewPointerTarget safeTarget =
                target == null ? DungeonEditorMainViewPointerTarget.empty() : target;
        return switch (safeTarget.targetCode()) {
            case DungeonEditorMainViewPointerTarget.CELL_TARGET ->
                    simpleTarget(toHitKind(safeTarget.elementKind()), safeTarget);
            case DungeonEditorMainViewPointerTarget.LABEL_TARGET,
                    DungeonEditorMainViewPointerTarget.GRAPH_NODE_TARGET -> simpleTarget(HitKind.LABEL, safeTarget);
            case DungeonEditorMainViewPointerTarget.HANDLE_TARGET -> handleTarget(safeTarget.handleRef());
            case DungeonEditorMainViewPointerTarget.BOUNDARY_TARGET -> boundaryTarget(safeTarget);
            default -> HitTarget.empty();
        };
    }

    private static HitTarget simpleTarget(HitKind kind, DungeonEditorMainViewPointerTarget target) {
        HandleTarget handleTarget = kind == HitKind.LABEL
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
                safeHandle.direction());
        return new HitTarget(
                HitKind.HANDLE,
                handleTarget.ownerId(),
                handleTarget.clusterId(),
                handleTarget.topologyRefKind(),
                handleTarget.topologyRefId(),
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
                HandleTarget.clusterLabel(
                        boundaryTarget.topologyRefKind(),
                        boundaryTarget.topologyRefId(),
                        boundaryTarget.ownerId(),
                        boundaryTarget.clusterId()),
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

    private static src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellTarget toCellTarget(
            DungeonEditorWorkspaceValues.Cell cell
    ) {
        DungeonEditorWorkspaceValues.Cell safeCell =
                cell == null ? DungeonEditorWorkspaceValues.Cell.empty() : cell;
        return new src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellTarget(
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
