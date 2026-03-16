package ui.async;

import javafx.concurrent.Task;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

/**
 * Shared task wiring for JavaFX background operations.
 */
public final class UiAsyncTasks {

    private UiAsyncTasks() {
        throw new AssertionError("No instances");
    }

    public static void submit(Task<?> task) {
        UiAsyncExecutor.submit(task);
    }

    public static <T> void submit(Task<T> task, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        submit(task, onSuccess, onError, null);
    }

    public static <T> void submit(Callable<T> work, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        Task<T> task = new Task<>() {
            @Override
            protected T call() throws Exception {
                return work.call();
            }
        };
        submit(task, onSuccess, onError);
    }

    public static void submitVoid(ThrowingRunnable work, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                work.run();
                return null;
            }
        };
        submit(task, ignored -> onSuccess.run(), onError);
    }

    public static <T> void submit(
            Task<T> task,
            Consumer<T> onSuccess,
            Consumer<Throwable> onError,
            Runnable onCancelled
    ) {
        task.setOnSucceeded(event -> onSuccess.accept(task.getValue()));
        task.setOnFailed(event -> onError.accept(task.getException()));
        if (onCancelled != null) {
            task.setOnCancelled(event -> onCancelled.run());
        }
        UiAsyncExecutor.submit(task);
    }

    @FunctionalInterface
    public interface ThrowingRunnable {
        void run() throws Exception;
    }
}
