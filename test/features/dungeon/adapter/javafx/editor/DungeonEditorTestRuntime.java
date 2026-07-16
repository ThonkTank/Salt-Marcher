package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.stage.Window;

class DungeonEditorTestRuntime extends DungeonEditorTestPersistence {

    static final int AWAIT_SECONDS = 60;
    static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @FunctionalInterface
    interface ThrowingRunnable {
        void run() throws Exception;
    }

    static void shutdownFx() throws Exception {
        runOnFxThread(() -> {
            hideWindowsWithoutImplicitExit();
            testsupport.JavaFxRuntime.shutdown();
        });
    }

    static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            testsupport.JavaFxRuntime.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Dungeon Editor test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Dungeon Editor behavior test failed.", failure[0]);
        }
    }

    static void cleanupRouteProofWindows() throws Exception {
        runOnFxThread(DungeonEditorTestRuntime::hideWindowsWithoutImplicitExit);
    }

    private static void hideWindowsWithoutImplicitExit() {
        Platform.setImplicitExit(false);
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
        }
    }

    static void runRoute(ThrowingRunnable action) throws Exception {
        try {
            runOnFxThread(action);
        } finally {
            cleanupRouteProofWindows();
        }
    }


}
