package features.world.dungeonmap.editor.session.ui;

import features.world.dungeonmap.editor.session.application.workflow.DungeonEditorSessionAsyncRunner;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

public final class DungeonEditorUiAsyncRunner implements DungeonEditorSessionAsyncRunner {

    @Override
    public <T> void submit(Callable<T> work, Consumer<T> onSuccess, Consumer<Throwable> onFailure) {
        UiAsyncTasks.submit(work, onSuccess, onFailure);
    }

    @Override
    public <T> CancellationHandle submitCancelable(
            Callable<T> work,
            Consumer<T> onSuccess,
            Consumer<Throwable> onFailure,
            Runnable onCancelled
    ) {
        Task<T> task = new Task<>() {
            @Override
            protected T call() throws Exception {
                return work.call();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onFailure, onCancelled);
        return () -> task.cancel();
    }
}
