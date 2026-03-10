package features.encounter.internal;

import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

public final class EncounterAsyncTaskSupport {

    private EncounterAsyncTaskSupport() {
        throw new AssertionError("No instances");
    }

    public static void cancel(Task<?> task) {
        if (task != null && task.isRunning()) {
            task.cancel();
        }
    }

    public static <T> void submit(
            Task<T> task,
            String failureContext,
            Consumer<T> onSuccess,
            BooleanSupplier isTaskActive
    ) {
        submit(task, failureContext, onSuccess, null, isTaskActive);
    }

    public static <T> void submit(
            Task<T> task,
            String failureContext,
            Consumer<T> onSuccess,
            Runnable onFailure,
            BooleanSupplier isTaskActive
    ) {
        UiAsyncTasks.submit(
                task,
                result -> {
                    if (task.isCancelled() || !isTaskActive.getAsBoolean()) {
                        return;
                    }
                    onSuccess.accept(result);
                },
                throwable -> {
                    if (!task.isCancelled() && isTaskActive.getAsBoolean()) {
                        UiErrorReporter.reportBackgroundFailure(failureContext, throwable);
                        if (onFailure != null) {
                            onFailure.run();
                        }
                    }
                },
                () -> {
                    if (isTaskActive.getAsBoolean() && onFailure != null) {
                        onFailure.run();
                    }
                });
    }
}
