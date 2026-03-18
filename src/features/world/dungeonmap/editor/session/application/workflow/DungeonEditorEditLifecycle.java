package features.world.dungeonmap.editor.session.application.workflow;

import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.application.DungeonEditorService;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;

import java.util.ArrayDeque;
import java.util.Objects;
import java.util.function.Consumer;

final class DungeonEditorEditLifecycle {

    private final DungeonEditorService editorService;
    private final DungeonEditorSessionAsyncRunner asyncRunner;
    private final DungeonEditorReloadLifecycle reloadLifecycle;
    private final Object stateLock;
    private long editSessionId;
    private long callbackSequence;
    private boolean editInFlight;
    private PendingEdit activeEdit;
    private DungeonEditorSessionAsyncRunner.CancellationHandle activeEditHandle =
            DungeonEditorSessionAsyncRunner.CancellationHandle.NO_OP;
    private final ArrayDeque<PendingEdit> pendingEdits = new ArrayDeque<>();

    DungeonEditorEditLifecycle(
            DungeonEditorService editorService,
            DungeonEditorSessionAsyncRunner asyncRunner,
            DungeonEditorReloadLifecycle reloadLifecycle,
            Object stateLock
    ) {
        this.editorService = Objects.requireNonNull(editorService, "editorService");
        this.asyncRunner = Objects.requireNonNull(asyncRunner, "asyncRunner");
        this.reloadLifecycle = Objects.requireNonNull(reloadLifecycle, "reloadLifecycle");
        this.stateLock = stateLock;
    }

    // Must be called under stateLock. Returns the handle that the caller must cancel outside the lock.
    DungeonEditorSessionAsyncRunner.CancellationHandle invalidateSessionForReload() {
        callbackSequence++;
        editSessionId++;
        pendingEdits.clear();
        return activeEditHandle;
    }

    void submitEdit(
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

    boolean isCurrentCallback(long request) {
        synchronized (stateLock) {
            return callbackSequence == request;
        }
    }

    private PendingEdit enqueueEditLocked(PendingEdit pendingEdit) {
        if (!acceptsEditLocked(pendingEdit)) {
            return null;
        }
        pendingEdits.addLast(pendingEdit);
        if (editInFlight) {
            return null;
        }
        editInFlight = true;
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
            activeEdit = pendingEdit;
            activeEditHandle = DungeonEditorSessionAsyncRunner.CancellationHandle.NO_OP;
        }
        DungeonEditorSessionAsyncRunner.CancellationHandle handle = asyncRunner.submitCancelable(
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
                    activeEditHandle = DungeonEditorSessionAsyncRunner.CancellationHandle.NO_OP;
                }
                nextEdit = pollNextPendingEditLocked();
                if (nextEdit == null) {
                    editInFlight = false;
                    return;
                }
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

    record PendingEdit(
            long mapId,
            DungeonEditorEditCommand command,
            Consumer<DungeonLayoutEditResult> onSuccess,
            Consumer<Throwable> onFailure,
            long request,
            long editSession
    ) {
    }
}
