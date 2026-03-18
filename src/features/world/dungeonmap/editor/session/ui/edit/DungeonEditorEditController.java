package features.world.dungeonmap.editor.session.ui.edit;

import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.edit.application.DungeonEditorEditPlan;
import features.world.dungeonmap.editor.edit.application.DungeonEditorEditPlanner;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.session.application.DungeonEditorSessionState;
import features.world.dungeonmap.editor.session.application.workflow.DungeonEditorSessionWorkflow;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionReadModel;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdateSink;
import features.world.dungeonmap.editor.session.ui.DungeonCorridorEditPort;
import features.world.dungeonmap.editor.session.ui.DungeonEditorSelectionController;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdate;
import features.world.dungeonmap.editor.workspace.ui.DungeonEditorSplitWorkspace;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonWallPathCommit;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;

import java.util.Objects;
import java.util.function.Function;

public final class DungeonEditorEditController implements DungeonCorridorEditPort {

    private final DungeonEditorSessionWorkflow sessionWorkflow;
    private final DungeonEditorSplitWorkspace workspace;
    private final DungeonEditorSessionReadModel sessionReadModel;
    private final DungeonEditorSessionState sessionState;
    private final DungeonEditorSelectionController selectionController;
    private final DungeonEditorSessionUpdateSink sessionUpdateSink;
    private final DungeonEditorEditSubmission editSubmission;

    public DungeonEditorEditController(
            DungeonEditorSessionWorkflow sessionWorkflow,
            DungeonEditorSplitWorkspace workspace,
            DungeonEditorSessionState sessionState,
            DungeonEditorSelectionController selectionController,
            Runnable clearTransientState,
            DungeonEditorSessionReadModel sessionReadModel,
            DungeonEditorSessionUpdateSink sessionUpdateSink
    ) {
        this.sessionWorkflow = Objects.requireNonNull(sessionWorkflow, "sessionWorkflow");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.sessionReadModel = Objects.requireNonNull(sessionReadModel, "sessionReadModel");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionController = Objects.requireNonNull(selectionController, "selectionController");
        this.sessionUpdateSink = Objects.requireNonNull(sessionUpdateSink, "sessionUpdateSink");
        Objects.requireNonNull(clearTransientState, "clearTransientState");
        DungeonEditorEditResultCoordinator resultCoordinator = new DungeonEditorEditResultCoordinator(
                workspace,
                selectionController,
                clearTransientState,
                sessionReadModel,
                sessionUpdateSink);
        this.editSubmission = new DungeonEditorEditSubmission(sessionReadModel, sessionWorkflow, resultCoordinator);
    }

    public void commitWallPathSegment(DungeonWallPathCommit request, boolean deleteMode) {
        if (request == null || request.edgeRefs() == null || request.edgeRefs().isEmpty()) {
            return;
        }
        DungeonEditorEditCommand command = new DungeonEditorEditCommand.ApplyWallPath(request.edgeRefs(), deleteMode);
        editSubmission.submit(
                command.getClass().getSimpleName(),
                (mapId, onSuccess, onError) -> sessionWorkflow.submitEdit(mapId,
                        // Wall-path edits still gate on the currently shown map id.
                        command,
                        onSuccess,
                        throwable -> {
                            workspace.wallPathState().revertPendingWallPathCommit();
                            onError.accept(throwable);
                        }),
                result -> DungeonEditorSessionEditOutcome.wallLayout(result, request.nextAnchor()));
    }

    public void dispatchCorridorSelection(DungeonCorridorEndpoint start, DungeonCorridorEndpoint target) {
        DungeonEditorEditPlan plan = DungeonEditorEditPlanner.planCorridorSelection(start, target, sessionReadModel.currentLayout());
        switch (plan) {
            case DungeonEditorEditPlan.Execute execute ->
                    submitCommand(execute.command(), DungeonEditorSessionEditOutcome::focusedLayout);
            case DungeonEditorEditPlan.SelectCorridorTarget select ->
                    selectionController.selectCorridorTargetSelection(select.target());
            case DungeonEditorEditPlan.NoOp ignored -> {
            }
        }
    }

    public void resetSelectedCorridorDoor() {
        var handle = sessionState.selectedCorridorDoorHandle();
        if (handle == null) {
            return;
        }
        submitCommand(
                new DungeonEditorEditCommand.ResetCorridorDoor(handle.corridorId(), handle.roomId()),
                DungeonEditorSessionEditOutcome::resetCorridorDoorLayout);
    }

    public void deleteSelectedCorridorWaypoint() {
        var handle = sessionState.selectedCorridorWaypointHandle();
        if (handle == null) {
            return;
        }
        deleteCorridorWaypoint(handle.corridorId(), handle.waypointIndex());
    }

    public void onEditRequested(DungeonEditorEditCommand command) {
        if (command == null) {
            return;
        }
        submitWorkspaceCommand(command);
    }

    public void onWallPathStateChanged() {
        sessionUpdateSink.applySessionUpdate(DungeonEditorSessionUpdate.statePaneChanged());
    }

    public void onWallPathCommitRequested(DungeonWallPathCommit request, boolean deleteMode) {
        commitWallPathSegment(request, deleteMode);
    }

    private void deleteCorridorWaypoint(long corridorId, int waypointIndex) {
        submitCommand(
                new DungeonEditorEditCommand.DeleteCorridorWaypoint(corridorId, waypointIndex),
                result -> DungeonEditorSessionEditOutcome.deleteCorridorWaypointLayout(result, corridorId, waypointIndex));
    }

    private void submitWorkspaceCommand(DungeonEditorEditCommand command) {
        switch (command) {
            case DungeonEditorEditCommand.MoveCluster ignored ->
                    submitCommand(command, DungeonEditorSessionEditOutcome::preserveSelection);
            case DungeonEditorEditCommand.MoveCorridorDoor edit ->
                    submitMovedCorridorDoorCommand(edit);
            case DungeonEditorEditCommand.AddCorridorWaypoint edit ->
                    submitAddedCorridorWaypointCommand(edit);
            case DungeonEditorEditCommand.MoveCorridorWaypoint edit ->
                    submitMovedCorridorWaypointCommand(edit);
            case DungeonEditorEditCommand.DeleteCorridorWaypoint edit ->
                    submitDeletedCorridorWaypointCommand(edit);
            default -> submitCommand(command, DungeonEditorSessionEditOutcome::focusedLayout);
        }
    }

    private void submitMovedCorridorDoorCommand(DungeonEditorEditCommand.MoveCorridorDoor command) {
        sessionState.selectCorridorDoorHandle(new CorridorDoorHandle(
                command.corridorId(),
                command.roomId()));
        submitCommand(
                command,
                result -> DungeonEditorSessionEditOutcome.corridorDoorLayout(result, command.corridorId(), command.roomId()));
    }

    private void submitAddedCorridorWaypointCommand(DungeonEditorEditCommand.AddCorridorWaypoint command) {
        submitCommand(
                command,
                result -> DungeonEditorSessionEditOutcome.corridorWaypointLayout(result, command.corridorId(), command.insertIndex()));
    }

    private void submitMovedCorridorWaypointCommand(DungeonEditorEditCommand.MoveCorridorWaypoint command) {
        sessionState.selectCorridorWaypointHandle(new CorridorWaypointHandle(
                command.corridorId(),
                command.waypointIndex()));
        submitCommand(
                command,
                result -> DungeonEditorSessionEditOutcome.corridorWaypointLayout(result, command.corridorId(), command.waypointIndex()));
    }

    private void submitDeletedCorridorWaypointCommand(DungeonEditorEditCommand.DeleteCorridorWaypoint command) {
        submitCommand(
                command,
                result -> DungeonEditorSessionEditOutcome.deleteCorridorWaypointLayout(result, command.corridorId(), command.waypointIndex()));
    }

    private void submitCommand(
            DungeonEditorEditCommand command,
            Function<DungeonLayoutEditResult, DungeonEditorSessionEditOutcome> outcomeMapper
    ) {
        if (command == null) {
            return;
        }
        editSubmission.submit(command.getClass().getSimpleName(), command, outcomeMapper);
    }
}
