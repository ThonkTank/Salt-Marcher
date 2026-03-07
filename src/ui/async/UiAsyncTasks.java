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
        task.setOnSucceeded(event -> onSuccess.accept(task.getValue()));
        task.setOnFailed(event -> onError.accept(task.getException()));
        UiAsyncExecutor.submit(task);
    }
}
