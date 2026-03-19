package features.world.quarantine.dungeonmap.foundation.async;

import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

public final class DungeonUiAsyncRunner implements DungeonAsyncRunner {

    @Override
    public <T> void submit(Callable<T> work, Consumer<T> onSuccess, Consumer<Throwable> onFailure) {
        submitCancelable(work, onSuccess, onFailure, null);
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
