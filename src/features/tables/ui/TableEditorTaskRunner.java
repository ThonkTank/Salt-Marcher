package features.tables.ui;

import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

public final class TableEditorTaskRunner {

    private TableEditorTaskRunner() {
        throw new AssertionError("No instances");
    }

    public static <T> void submit(
            String owner,
            String errorLabel,
            Callable<T> work,
            Consumer<T> onSuccess,
            Consumer<Throwable> onFailure) {
        Task<T> task = new Task<>() {
            @Override
            protected T call() throws Exception {
                return work.call();
            }
        };
        Consumer<T> successHandler = onSuccess != null ? onSuccess : ignored -> {};
        UiAsyncTasks.submit(
                task,
                successHandler,
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure(owner + "." + errorLabel + "()", throwable);
                    if (onFailure != null) {
                        onFailure.accept(throwable);
                    }
                });
    }
}
