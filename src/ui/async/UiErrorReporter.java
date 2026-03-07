package ui.async;

import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Shared UI-facing error logging helper for background operations.
 */
public final class UiErrorReporter {

    private static final Logger LOGGER = Logger.getLogger(UiErrorReporter.class.getName());

    private UiErrorReporter() {
        throw new AssertionError("No instances");
    }

    public static void reportBackgroundFailure(String operation, Throwable throwable) {
        if (throwable == null) {
            LOGGER.log(Level.WARNING, "{0} failed (unknown error)", operation);
            return;
        }
        LOGGER.log(Level.WARNING, operation + " failed", throwable);
    }
}
