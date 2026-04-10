package clean.shell.async;

import clean.shell.async.input.ComposeAsyncInput;

/**
 * Clean shell-wide async composition seam.
 */
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

        private AsyncAssembly(ComposeAsyncInput input) {
        }

        private ComposeAsyncInput.AsyncInput composeAsync() {
            return new ComposeAsyncInput.AsyncInput(this::reportBackgroundFailure);
        }

        private void reportBackgroundFailure(String operationName, Throwable throwable) {
            String resolvedOperationName = operationName == null || operationName.isBlank()
                    ? "Unbekannte Hintergrundaufgabe"
                    : operationName.trim();
            if (throwable == null) {
                LOGGER.log(java.util.logging.Level.WARNING, "{0} failed (unknown error)", resolvedOperationName);
                return;
            }
            LOGGER.log(java.util.logging.Level.WARNING, resolvedOperationName + " failed", throwable);
        }
    }
}
