package ui.async;

import javafx.concurrent.Task;

import java.util.function.Consumer;

/**
 * Shared task wiring for JavaFX background operations.
 */
public final class UiAsyncTasks {

    private UiAsyncTasks() {
        throw new AssertionError("No instances");
    }

    public static <T> void submit(Task<T> task, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        submit(task, onSuccess, onError, null);
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
}
