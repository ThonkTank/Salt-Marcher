package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionController;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.session.EditorWorkspacePort;
import features.world.quarantine.dungeonmap.editor.shell.DungeonEditorUiFeedback;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathCommit;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.loading.DungeonLoadingCapability;

import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonEditorEditController implements DungeonCorridorEditPort {

    private final DungeonLoadingCapability loadingCapability;
    private final EditorWorkspacePort workspace;
    private final Supplier<DungeonLayout> currentLayoutSupplier;
    private final DungeonEditorSessionState sessionState;
    private final DungeonEditorSelectionController selectionController;
    private final DungeonEditorUiFeedback uiFeedback;
    private final DungeonEditorEditSubmission editSubmission;

    public DungeonEditorEditController(
            EditorWorkspacePort workspace,
            DungeonEditorSessionState sessionState,
            DungeonEditorSelectionController selectionController,
            Runnable clearTransientState,
            Supplier<DungeonLayout> currentLayoutSupplier,
            DungeonLoadingCapability loadingCapability,
            DungeonEditorUiFeedback uiFeedback
    ) {
        this.loadingCapability = Objects.requireNonNull(loadingCapability, "loadingCapability");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.currentLayoutSupplier = Objects.requireNonNull(currentLayoutSupplier, "currentLayoutSupplier");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionController = Objects.requireNonNull(selectionController, "selectionController");
        this.uiFeedback = Objects.requireNonNull(uiFeedback, "uiFeedback");
        Objects.requireNonNull(clearTransientState, "clearTransientState");
        DungeonEditorEditResultCoordinator resultCoordinator = new DungeonEditorEditResultCoordinator(
                workspace,
                selectionController,
                clearTransientState,
                loadingCapability,
                uiFeedback);
        this.editSubmission = new DungeonEditorEditSubmission(loadingCapability, resultCoordinator);
    }

    public void commitWallPathSegment(DungeonWallPathCommit request, boolean deleteMode) {
        if (request == null || request.edgeRefs() == null || request.edgeRefs().isEmpty()) {
            return;
        }
        DungeonEditorEditCommand command = new DungeonEditorEditCommand.ApplyWallPath(request.edgeRefs(), deleteMode);
        editSubmission.submit(
                command.getClass().getSimpleName(),
                (onSuccess, onError) -> loadingCapability.submitEdit(
                        command,
                        onSuccess,
                        throwable -> {
                            workspace.wallPathState().revertPendingWallPathCommit();
                            onError.accept(throwable);
                        }),
                result -> DungeonEditorSessionEditOutcome.wallLayout(result, request.nextAnchor()));
    }

    public void dispatchCorridorSelection(DungeonCorridorEndpoint start, DungeonCorridorEndpoint target) {
        DungeonEditorEditPlan plan = DungeonCorridorEditPlanner.planCorridorSelection(start, target, currentLayoutSupplier.get());
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
        uiFeedback.onStatePaneChanged();
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
