package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorBoundaryHitTarget;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorConnectionHitTarget;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorCorridorNodeHitTarget;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorCorridorSegmentHitTarget;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorHitService;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorHitTarget;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorLabelHitTarget;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorRoomBoundaryHitTarget;

import java.util.Objects;

public final class DungeonEditorInteractionPolicy {

    public enum EditorInteractionScope {
        BOUNDARY,
        NODE,
        SEGMENT,
        LABEL,
        TRANSITION,
        TRAVERSABLE_TILE,
        NONE
    }

    public record EditorInteractionDecision(EditorInteractionScope scope, boolean dispatchToTool) {
        public EditorInteractionDecision {
            Objects.requireNonNull(scope, "scope");
        }
    }

    private final DungeonHitService hitService;
    private final DungeonDragService dragService;
    private final DungeonPlacementValidator placementValidator;
    private final DungeonEditorHitService editorHitService;

    public DungeonEditorInteractionPolicy(
            DungeonHitService hitService,
            DungeonDragService dragService,
            DungeonPlacementValidator placementValidator,
            DungeonEditorHitService editorHitService
    ) {
        this.hitService = Objects.requireNonNull(hitService, "hitService");
        this.dragService = Objects.requireNonNull(dragService, "dragService");
        this.placementValidator = Objects.requireNonNull(placementValidator, "placementValidator");
        this.editorHitService = Objects.requireNonNull(editorHitService, "editorHitService");
    }

    public EditorInteractionDecision decidePress(
            DungeonLayout layout,
            DungeonCanvasPointerEvent event,
            DungeonCanvasCamera camera,
            int level
    ) {
        if (layout == null || event == null || camera == null || !event.isPrimaryButton()) {
            return new EditorInteractionDecision(EditorInteractionScope.NONE, false);
        }

        DungeonDragService.DungeonDragResult dragResult = dragService.begin(
                layout,
                event,
                camera,
                new DungeonDragService.DungeonDragTarget.TileDragTarget(event.gridCell()));
        if (!(dragResult instanceof DungeonDragService.DungeonDragResult.Started)) {
            return new EditorInteractionDecision(EditorInteractionScope.NONE, false);
        }

        DungeonEditorHitTarget editorTarget = editorHitService.hitAt(layout, event.canvasPoint(), camera);
        if (editorTarget instanceof DungeonEditorBoundaryHitTarget || editorTarget instanceof DungeonEditorRoomBoundaryHitTarget) {
            return new EditorInteractionDecision(EditorInteractionScope.BOUNDARY, true);
        }
        if (editorTarget instanceof DungeonEditorCorridorNodeHitTarget) {
            return new EditorInteractionDecision(EditorInteractionScope.NODE, true);
        }
        if (editorTarget instanceof DungeonEditorCorridorSegmentHitTarget || editorTarget instanceof DungeonEditorConnectionHitTarget) {
            return new EditorInteractionDecision(EditorInteractionScope.SEGMENT, true);
        }
        if (editorTarget instanceof DungeonEditorLabelHitTarget) {
            return new EditorInteractionDecision(EditorInteractionScope.LABEL, true);
        }

        DungeonHitService.DungeonHitTarget coarseHit = hitService.hitAt(layout, event, level);
        if (coarseHit instanceof DungeonHitService.DungeonHitTarget.TransitionTarget) {
            return new EditorInteractionDecision(EditorInteractionScope.TRANSITION, true);
        }
        if (placementValidator.validateTraversable(layout, event, camera, level)
                instanceof DungeonPlacementValidator.PlacementResult.Valid) {
            return new EditorInteractionDecision(EditorInteractionScope.TRAVERSABLE_TILE, true);
        }
        return new EditorInteractionDecision(EditorInteractionScope.NONE, false);
    }

    public boolean decideDrag(
            DungeonLayout layout,
            DungeonCanvasPointerEvent event,
            DungeonCanvasCamera camera,
            int level
    ) {
        if (layout == null || event == null || camera == null || !event.isPrimaryButtonDown()) {
            return false;
        }
        if (editorHitService.hitAt(layout, event.canvasPoint(), camera) != null) {
            return true;
        }
        return placementValidator.validateTraversable(layout, event, camera, level)
                instanceof DungeonPlacementValidator.PlacementResult.Valid;
    }

    public boolean decideRelease(
            DungeonLayout layout,
            DungeonCanvasPointerEvent event,
            DungeonCanvasCamera camera,
            int level
    ) {
        if (layout == null || event == null || camera == null) {
            return false;
        }
        if (editorHitService.hitAt(layout, event.canvasPoint(), camera) != null) {
            return true;
        }
        return placementValidator.validateTraversable(layout, event, camera, level)
                instanceof DungeonPlacementValidator.PlacementResult.Valid;
    }
}
