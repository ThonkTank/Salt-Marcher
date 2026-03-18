package features.world.dungeonmap.editor.session.ui.tool;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.session.application.DungeonEditorSessionState;
import features.world.dungeonmap.editor.session.ui.DungeonCorridorEditPort;
import features.world.dungeonmap.editor.session.ui.DungeonEditorSelectionController;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;

import java.util.Objects;

public final class DungeonCorridorDraftController {

    private final DungeonEditorSessionState sessionState;
    private DungeonEditorSelectionController selectionController;
    private final DungeonCorridorEditPort editPort;

    private DungeonCorridorEndpoint pendingCorridorStart;
    private CorridorDraft suspendedCorridorDraft;

    public DungeonCorridorDraftController(
            DungeonEditorSessionState sessionState,
            DungeonCorridorEditPort editPort
    ) {
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.editPort = Objects.requireNonNull(editPort, "editPort");
    }

    public void setSelectionController(DungeonEditorSelectionController selectionController) {
        this.selectionController = Objects.requireNonNull(selectionController, "selectionController");
    }

    public boolean hasPendingStart() {
        return pendingCorridorStart != null;
    }

    public void selectTarget(DungeonCorridorEndpoint target) {
        if (pendingCorridorStart == null) {
            pendingCorridorStart = target;
            selectionController.selectCorridorTargetSelection(target);
            return;
        }
        if (pendingCorridorStart.equals(target)) {
            pendingCorridorStart = null;
            selectionController.selectCorridorTargetSelection(target);
            return;
        }
        DungeonCorridorEndpoint start = pendingCorridorStart;
        pendingCorridorStart = null;
        editPort.dispatchCorridorSelection(start, target);
    }

    public void clearDraft() {
        pendingCorridorStart = null;
        suspendedCorridorDraft = null;
    }

    public void snapshotDraft() {
        suspendedCorridorDraft = new CorridorDraft(
                pendingCorridorStart,
                sessionState.selectedCorridorDoorHandle(),
                sessionState.selectedCorridorWaypointHandle());
    }

    public void clearSuspendedDraft() {
        suspendedCorridorDraft = null;
    }

    /**
     * Restores the suspended corridor draft.
     *
     * @return true if a draft was restored, false if there was nothing to restore
     */
    public boolean restoreDraft() {
        if (suspendedCorridorDraft == null) {
            return false;
        }
        CorridorDraft draft = suspendedCorridorDraft;
        suspendedCorridorDraft = null;
        pendingCorridorStart = draft.pendingStart();
        if (draft.selectedDoorHandle() != null) {
            sessionState.selectCorridorDoorHandle(draft.selectedDoorHandle());
        } else if (draft.selectedWaypointHandle() != null) {
            sessionState.selectCorridorWaypointHandle(draft.selectedWaypointHandle());
        } else {
            sessionState.clearCorridorEditSelection();
        }
        return true;
    }

    public record CorridorDraft(
            DungeonCorridorEndpoint pendingStart,
            CorridorDoorHandle selectedDoorHandle,
            CorridorWaypointHandle selectedWaypointHandle
    ) {
    }
}
