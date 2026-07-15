package testsupport;

import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;

public final class JavaFxRuntime {

    private static final AtomicBoolean STARTED = new AtomicBoolean();

    private JavaFxRuntime() {
    }

    public static void startup(Runnable action) {
        if (STARTED.compareAndSet(false, true)) {
            Platform.startup(action);
            return;
        }
        Platform.runLater(action);
    }

    public static void shutdown() {
        // The worker JVM owns JavaFX. Individual test classes only close windows.
    }
}
