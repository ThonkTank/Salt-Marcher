package features.world.quarantine.dungeonmap.editor.session.tool;

import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonCorridorEditPort;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionController;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;

import java.util.Objects;

public final class DungeonCorridorDraftController {

    private final DungeonEditorSessionState sessionState;
    private final DungeonEditorSelectionController selectionController;
    private final DungeonCorridorEditPort editPort;

    private DungeonCorridorEndpoint pendingCorridorStart;
    private CorridorDraft suspendedCorridorDraft;

    public DungeonCorridorDraftController(
            DungeonEditorSessionState sessionState,
            DungeonCorridorEditPort editPort,
            DungeonEditorSelectionController selectionController
    ) {
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.editPort = Objects.requireNonNull(editPort, "editPort");
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
