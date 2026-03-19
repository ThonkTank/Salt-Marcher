package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.editor.DungeonEditorService;
import features.world.quarantine.dungeonmap.foundation.async.DungeonAsyncRunner;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;

import java.util.ArrayDeque;
import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonEditorEditLifecycle {

    enum EditPhase { IDLE, QUEUED, IN_FLIGHT }

    private final DungeonEditorService editorService;
    private final DungeonAsyncRunner asyncRunner;
    private final DungeonEditorReloadLifecycle reloadLifecycle;
    private final Object stateLock;
    private long editSessionId;
    private long callbackSequence;
    private EditPhase phase = EditPhase.IDLE;
    private PendingEdit activeEdit;
    private DungeonAsyncRunner.CancellationHandle activeEditHandle =
            DungeonAsyncRunner.CancellationHandle.NO_OP;
    private final ArrayDeque<PendingEdit> pendingEdits = new ArrayDeque<>();

    public DungeonEditorEditLifecycle(
            DungeonEditorService editorService,
            DungeonAsyncRunner asyncRunner,
            DungeonEditorReloadLifecycle reloadLifecycle,
            Object stateLock
    ) {
        this.editorService = Objects.requireNonNull(editorService, "editorService");
        this.asyncRunner = Objects.requireNonNull(asyncRunner, "asyncRunner");
        this.reloadLifecycle = Objects.requireNonNull(reloadLifecycle, "reloadLifecycle");
        this.stateLock = stateLock;
    }

    // Must be called under stateLock. Returns the handle that the caller must cancel outside the lock.
    public DungeonAsyncRunner.CancellationHandle invalidateSessionForReload() {
        callbackSequence++;
        editSessionId++;
        pendingEdits.clear();
        return activeEditHandle;
    }

    public void submitEdit(
            long mapId,
            DungeonEditorEditCommand command,
            Consumer<DungeonLayoutEditResult> onSuccess,
            Consumer<Throwable> onFailure
    ) {
        PendingEdit nextEdit;
        synchronized (stateLock) {
            long request = ++callbackSequence;
            PendingEdit pendingEdit = new PendingEdit(mapId, command, onSuccess, onFailure, request, editSessionId);
            nextEdit = enqueueEditLocked(pendingEdit);
        }
        if (nextEdit != null) {
            submitPendingEdit(nextEdit);
        }
    }

    public boolean isCurrentCallback(long request) {
        synchronized (stateLock) {
            return callbackSequence == request;
        }
    }

    // Must be called under stateLock.
    private void transitionTo(EditPhase newPhase) {
        boolean valid = switch (newPhase) {
            case IDLE -> phase == EditPhase.IN_FLIGHT;
            case QUEUED -> phase == EditPhase.IDLE || phase == EditPhase.IN_FLIGHT;
            case IN_FLIGHT -> phase == EditPhase.QUEUED;
        };
        if (!valid) {
            throw new IllegalStateException("Invalid EditPhase transition: " + phase + " → " + newPhase);
        }
        phase = newPhase;
    }

    private PendingEdit enqueueEditLocked(PendingEdit pendingEdit) {
        if (!acceptsEditLocked(pendingEdit)) {
            return null;
        }
        pendingEdits.addLast(pendingEdit);
        if (phase != EditPhase.IDLE) {
            return null;
        }
        transitionTo(EditPhase.QUEUED);
        return pollNextPendingEditLocked();
    }

    private boolean acceptsEditLocked(PendingEdit pendingEdit) {
        return pendingEdit.editSession() == editSessionId
                && reloadLifecycle.editingEnabled()
                && Objects.equals(reloadLifecycle.sessionMapId(), pendingEdit.mapId());
    }

    private PendingEdit pollNextPendingEditLocked() {
        PendingEdit nextEdit = pendingEdits.pollFirst();
        while (nextEdit != null && !acceptsEditLocked(nextEdit)) {
            nextEdit = pendingEdits.pollFirst();
        }
        return nextEdit;
    }

    private void submitPendingEdit(PendingEdit pendingEdit) {
        synchronized (stateLock) {
            transitionTo(EditPhase.IN_FLIGHT);
            activeEdit = pendingEdit;
            activeEditHandle = DungeonAsyncRunner.CancellationHandle.NO_OP;
        }
        DungeonAsyncRunner.CancellationHandle handle = asyncRunner.submitCancelable(
                () -> executePendingEdit(pendingEdit),
                result -> finishPendingEdit(pendingEdit, () -> {
                    if (!result.discarded() && isCurrentCallback(pendingEdit.request())) {
                        pendingEdit.onSuccess().accept(result.result());
                    }
                }),
                throwable -> finishPendingEdit(pendingEdit, () -> {
                    if (isCurrentCallback(pendingEdit.request())) {
                        pendingEdit.onFailure().accept(throwable);
                    }
                }),
                () -> finishPendingEdit(pendingEdit, () -> {
                }));
        synchronized (stateLock) {
            if (activeEdit == pendingEdit) {
                activeEditHandle = handle;
            }
        }
    }

    private EditExecution executePendingEdit(PendingEdit pendingEdit) throws Exception {
        if (shouldDiscardBeforePersist(pendingEdit)) {
            return EditExecution.discardedResult();
        }
        return EditExecution.completedResult(editorService.applyEdit(pendingEdit.mapId(), pendingEdit.command()));
    }

    private boolean shouldDiscardBeforePersist(PendingEdit pendingEdit) {
        synchronized (stateLock) {
            // Veraltete Edits dürfen editorService.applyEdit(...) nicht mehr erreichen.
            return !acceptsEditLocked(pendingEdit);
        }
    }

    private void finishPendingEdit(PendingEdit completedEdit, Runnable callback) {
        try {
            callback.run();
        } finally {
            PendingEdit nextEdit;
            synchronized (stateLock) {
                if (activeEdit == completedEdit) {
                    activeEdit = null;
                    activeEditHandle = DungeonAsyncRunner.CancellationHandle.NO_OP;
                }
                nextEdit = pollNextPendingEditLocked();
                if (nextEdit == null) {
                    transitionTo(EditPhase.IDLE);
                    return;
                }
                transitionTo(EditPhase.QUEUED);
            }
            submitPendingEdit(nextEdit);
        }
    }

    private record EditExecution(boolean discarded, DungeonLayoutEditResult result) {

        private static EditExecution discardedResult() {
            return new EditExecution(true, null);
        }

        private static EditExecution completedResult(DungeonLayoutEditResult result) {
            return new EditExecution(false, result);
        }
    }

    public record PendingEdit(
            long mapId,
            DungeonEditorEditCommand command,
            Consumer<DungeonLayoutEditResult> onSuccess,
            Consumer<Throwable> onFailure,
            long request,
            long editSession
    ) {
    }
}
