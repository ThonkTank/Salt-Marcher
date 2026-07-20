package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.canvas.Canvas;
import javafx.stage.Stage;
import javafx.stage.Window;
import features.dungeon.adapter.javafx.map.DungeonMapView;
import platform.ui.mapcanvas.MapCanvasLayer;
import platform.ui.mapcanvas.MapCanvasPane;

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

    static void releaseProofWindowsBeforeBinding() {
        hideWindowsWithoutImplicitExit();
    }

    private static void hideWindowsWithoutImplicitExit() {
        Platform.setImplicitExit(false);
        for (Window window : List.copyOf(Window.getWindows())) {
            Scene scene = window.getScene();
            if (scene != null) {
                releaseNode(scene.getRoot());
            }
            if (window instanceof Stage stage) {
                stage.hide();
                stage.setScene(null);
                stage.close();
            } else {
                window.hide();
            }
        }
    }

    private static void releaseNode(Node node) {
        if (node instanceof DungeonMapView mapView) {
            mapView.bind(null);
        }
        if (node instanceof MapCanvasPane pane) {
            releaseCanvas(pane.canvas(MapCanvasLayer.BASE));
            releaseCanvas(pane.canvas(MapCanvasLayer.INTERACTION));
            releaseCanvas(pane.canvas(MapCanvasLayer.ACTOR));
        }
        if (node instanceof Parent parent) {
            for (Node child : List.copyOf(parent.getChildrenUnmodifiable())) {
                releaseNode(child);
            }
        }
    }

    private static void releaseCanvas(Canvas canvas) {
        canvas.widthProperty().unbind();
        canvas.heightProperty().unbind();
        canvas.setWidth(0.0);
        canvas.setHeight(0.0);
    }

    static void runRoute(ThrowingRunnable action) throws Exception {
        try {
            runOnFxThread(action);
        } finally {
            cleanupRouteProofWindows();
        }
    }


}
