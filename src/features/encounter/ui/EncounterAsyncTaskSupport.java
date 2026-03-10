package features.encounter.ui;

import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

final class EncounterAsyncTaskSupport {

    private EncounterAsyncTaskSupport() {
        throw new AssertionError("No instances");
    }

    static void cancel(Task<?> task) {
        if (task != null && task.isRunning()) {
            task.cancel();
        }
    }

    static <T> void submit(
            Task<T> task,
            String failureContext,
            Consumer<T> onSuccess,
            BooleanSupplier isTaskActive
    ) {
        submit(task, failureContext, onSuccess, null, isTaskActive);
    }

    static <T> void submit(
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
