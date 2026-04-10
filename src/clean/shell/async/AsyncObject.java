package clean.shell.async;

import clean.shell.async.input.ComposeAsyncInput;

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

        private static final java.util.logging.Logger LOGGER =
                java.util.logging.Logger.getLogger(AsyncObject.class.getName());
        private static final java.util.concurrent.atomic.AtomicInteger THREAD_COUNTER =
                new java.util.concurrent.atomic.AtomicInteger(1);
        private static final java.util.concurrent.ThreadFactory THREAD_FACTORY = runnable -> {
            Thread thread = new Thread(runnable, "sm-clean-shell-" + THREAD_COUNTER.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        };
        private static final java.util.concurrent.ThreadPoolExecutor EXECUTOR =
                new java.util.concurrent.ThreadPoolExecutor(
                        2,
                        4,
                        30L,
                        java.util.concurrent.TimeUnit.SECONDS,
                        new java.util.concurrent.ArrayBlockingQueue<>(32),
                        THREAD_FACTORY,
                        new java.util.concurrent.ThreadPoolExecutor.AbortPolicy()
                );

        private AsyncAssembly(ComposeAsyncInput input) {
        }

        private ComposeAsyncInput.AsyncInput composeAsync() {
            return new ComposeAsyncInput.AsyncInput(
                    this::submitBackground,
                    this::reportBackgroundFailure
            );
        }

        private void submitBackground(ComposeAsyncInput.SubmitBackgroundInput input) {
            if (input == null) {
                return;
            }
            javafx.concurrent.Task<Void> task = new javafx.concurrent.Task<>() {
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
                        throwable
                ));
                if (input.onFailure() != null) {
                    input.onFailure().accept(throwable);
                }
            });
            if (input.onCancelled() != null) {
                task.setOnCancelled(event -> input.onCancelled().run());
            }
            try {
                EXECUTOR.execute(task);
            } catch (java.util.concurrent.RejectedExecutionException rejection) {
                task.cancel();
                reportBackgroundFailure(new ComposeAsyncInput.ReportBackgroundFailureInput(
                        input.operationName() == null || input.operationName().isBlank()
                                ? "Hintergrundaufgabe abgelehnt"
                                : input.operationName() + " (abgelehnt)",
                        rejection
                ));
                if (input.onFailure() != null) {
                    input.onFailure().accept(rejection);
                }
            }
        }

        private void reportBackgroundFailure(ComposeAsyncInput.ReportBackgroundFailureInput input) {
            if (input == null) {
                return;
            }
            String operationName = input.operationName() == null || input.operationName().isBlank()
                    ? "Unbekannte Hintergrundaufgabe"
                    : input.operationName().trim();
            if (input.throwable() == null) {
                LOGGER.log(java.util.logging.Level.WARNING, "{0} failed (unknown error)", operationName);
                return;
            }
            LOGGER.log(java.util.logging.Level.WARNING, operationName + " failed", input.throwable());
        }
    }
}
