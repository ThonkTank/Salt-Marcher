package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonPlacementValidator;
import features.world.dungeonmap.shell.interaction.DungeonSelection;
import features.world.dungeonmap.shell.interaction.DungeonSelectionDecision;

import java.util.Objects;

public final class DungeonEditorSelectionPolicy {

    public enum EditorInteractionPhase {
        PRESS,
        DRAG,
        RELEASE
    }

    private final DungeonPlacementValidator placementValidator;

    public DungeonEditorSelectionPolicy(DungeonPlacementValidator placementValidator) {
        this.placementValidator = Objects.requireNonNull(placementValidator, "placementValidator");
    }

    public DungeonSelectionDecision select(
            EditorInteractionPhase phase,
            DungeonEditorTool tool,
            DungeonLayout activeMap,
            DungeonCanvasPointerEvent event,
            DungeonHitSnapshot snapshot
    ) {
        Objects.requireNonNull(phase, "phase");
        DungeonSelection selection = new DungeonSelection(
                Objects.requireNonNull(snapshot, "snapshot"),
                snapshot.candidates());
        if (tool == null || event == null || activeMap == null || !primaryButtonAllowed(phase, event)) {
            return new DungeonSelectionDecision(selection, false, false);
        }
        DungeonHitSubject primarySubject = selection.primary() == null
                ? null
                : selection.primary().descriptor().subject();
        if (isImmediateDispatchSubject(primarySubject)) {
            return new DungeonSelectionDecision(selection, true, false);
        }
        boolean traversable = placementValidator.validateTraversable(
                activeMap,
                snapshot.probe().gridCell(),
                snapshot.probe().levelZ()) instanceof DungeonPlacementValidator.PlacementResult.Valid;
        return new DungeonSelectionDecision(selection, traversable, false);
    }

    private static boolean primaryButtonAllowed(EditorInteractionPhase phase, DungeonCanvasPointerEvent event) {
        return switch (phase) {
            case PRESS -> event.isPrimaryButton();
            case DRAG -> event.isPrimaryButtonDown();
            case RELEASE -> true;
        };
    }

    private static boolean isImmediateDispatchSubject(DungeonHitSubject subject) {
        return subject instanceof DungeonHitSubject.ClusterLabelSubject
                || subject instanceof DungeonHitSubject.ClusterBoundarySubject
                || subject instanceof DungeonHitSubject.RoomBoundarySubject
                || subject instanceof DungeonHitSubject.CorridorNodeSubject
                || subject instanceof DungeonHitSubject.CorridorCornerSubject
                || subject instanceof DungeonHitSubject.CorridorSegmentSubject
                || subject instanceof DungeonHitSubject.ConnectionSubject
                || subject instanceof DungeonHitSubject.TransitionSubject;
    }
}
