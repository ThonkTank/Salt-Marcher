package src.domain.dungeoneditor.model.interaction.helper;

import src.domain.dungeoneditor.model.interaction.model.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorMainViewInputBoundaryTranslationHelper {
    private static final double VERTEX_SNAP_DISTANCE = 0.22;

    PointerState resolvePointerState(
            double canvasX,
            double canvasY,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef
    ) {
        int q = (int) Math.floor(canvasX);
        int r = (int) Math.floor(canvasY);
        HitTarget hitTarget = DungeonEditorMainViewHitRefBoundaryTranslationHelper.parseHitTarget(hitRef);
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
