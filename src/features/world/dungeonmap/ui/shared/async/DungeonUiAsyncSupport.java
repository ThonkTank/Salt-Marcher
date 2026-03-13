package features.world.dungeonmap.ui.shared.async;

import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

public final class DungeonUiAsyncSupport {

    private DungeonUiAsyncSupport() {
        throw new AssertionError("No instances");
    }

    public static <T> void submitValue(Callable<T> action, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        Task<T> task = new Task<>() {
            @Override
            protected T call() throws Exception {
                return action.call();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public static void submitAction(ThrowingRunnable action, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                action.run();
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    @FunctionalInterface
    public interface ThrowingRunnable {
        void run() throws Exception;
    }
}
