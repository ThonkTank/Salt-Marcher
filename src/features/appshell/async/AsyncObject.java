package features.appshell.async;

import features.appshell.async.input.ComposeAsyncInput;
import javafx.concurrent.Task;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Clean shell-wide async composition seam.
 */
@SuppressWarnings("unused")
public final class AsyncObject {

    private final ComposeAsyncInput.AsyncInput async;

    public AsyncObject(ComposeAsyncInput input) {
        ComposeAsyncInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.async = new AsyncAssembly(resolvedInput).composeAsync();
    }

    public ComposeAsyncInput.AsyncInput composeAsync(ComposeAsyncInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return async;
    }

    private static final class AsyncAssembly {

        private static final Logger LOGGER = Logger.getLogger(AsyncObject.class.getName());
        private static final AtomicInteger THREAD_COUNTER = new AtomicInteger(1);
        private static final ThreadFactory THREAD_FACTORY = runnable -> {
            Thread thread = new Thread(runnable, "sm-clean-async-" + THREAD_COUNTER.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        };
        private static final ThreadPoolExecutor EXECUTOR = new ThreadPoolExecutor(
                2,
                4,
                30L,
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(64),
                THREAD_FACTORY,
                new ThreadPoolExecutor.AbortPolicy());

        private AsyncAssembly(ComposeAsyncInput input) {
        }

        private ComposeAsyncInput.AsyncInput composeAsync() {
            return new ComposeAsyncInput.AsyncInput(
                    this::submitBackground,
                    this::reportBackgroundFailure);
        }

        private void submitBackground(ComposeAsyncInput.SubmitBackgroundInput input) {
            Task<Void> task = new Task<>() {
                @Override
                protected Void call() throws Exception {
                    if (input.work() != null) {
                        input.work().call();
                    }
                    return null;
                }
            };
            task.setOnSucceeded(event -> {
                if (input.onSuccess() != null) {
                    input.onSuccess().run();
                }
            });
            task.setOnFailed(event -> {
                Throwable throwable = task.getException();
                reportBackgroundFailure(new ComposeAsyncInput.ReportBackgroundFailureInput(
                        input.operationName(),
                        throwable));
                if (input.onFailure() != null) {
                    input.onFailure().accept(throwable);
                }
            });
            if (input.onCancelled() != null) {
                task.setOnCancelled(event -> input.onCancelled().run());
            }
            try {
                EXECUTOR.execute(task);
            } catch (RejectedExecutionException rejection) {
                task.cancel();
                reportBackgroundFailure(new ComposeAsyncInput.ReportBackgroundFailureInput(
                        input.operationName() == null || input.operationName().isBlank()
                                ? "Hintergrundaufgabe abgelehnt"
                                : input.operationName() + " (abgelehnt)",
                        rejection));
                if (input.onFailure() != null) {
                    input.onFailure().accept(rejection);
                }
            }
        }

        private void reportBackgroundFailure(ComposeAsyncInput.ReportBackgroundFailureInput input) {
            String resolvedOperationName = input.operationName() == null || input.operationName().isBlank()
                    ? "Unbekannte Hintergrundaufgabe"
                    : input.operationName().trim();
            if (input.throwable() == null) {
                LOGGER.log(Level.WARNING, "{0} failed (unknown error)", resolvedOperationName);
                return;
            }
            LOGGER.log(Level.WARNING, resolvedOperationName + " failed", input.throwable());
        }
    }
}
