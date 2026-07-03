package src.view.leftbartabs.worldplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.ToggleButton;
import javafx.stage.Stage;
import javafx.stage.Window;

public final class WorldPlannerControlsRawInputHarness {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private final WorldPlannerControlsContentModel model = new WorldPlannerControlsContentModel();
    private final List<WorldPlannerControlsViewInputEvent> events = new ArrayList<>();
    private WorldPlannerControlsView view;

    private WorldPlannerControlsRawInputHarness() {
    }

    public static void main(String[] args) throws Exception {
        WorldPlannerControlsRawInputHarness harness = new WorldPlannerControlsRawInputHarness();
        try {
            runOnFxThread(harness::start);
            runOnFxThread(harness::assertProjectionRenderDoesNotPublishInput);
            runOnFxThread(harness::assertUserModuleSwitchesPublishOneInput);
            shutdownFx();
            System.out.println("World Planner controls raw-input harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private void start() {
        view = new WorldPlannerControlsView();
        view().onViewInputEvent(events::add);
        view().bind(model);
        Stage stage = new Stage();
        stage.setScene(new Scene(view(), 620.0, 120.0));
        stage.show();
        view().applyCss();
        view().layout();
    }

    private void assertProjectionRenderDoesNotPublishInput() {
        for (int moduleIndex = 0; moduleIndex < 4; moduleIndex++) {
            events.clear();
            model.activate(moduleIndex);
            view().applyCss();
            view().layout();
            assertEquals(0, events.size(), "projection render must not publish raw input for module " + moduleIndex);
            assertTrue(moduleButton(moduleIndex).isSelected(), "projection selects module " + moduleIndex);
        }
    }

    private void assertUserModuleSwitchesPublishOneInput() {
        for (int moduleIndex = 0; moduleIndex < 4; moduleIndex++) {
            model.activate(0);
            events.clear();
            moduleButton(moduleIndex).fire();
            assertEquals(1, events.size(), "user module switch must publish one input for module " + moduleIndex);
            WorldPlannerControlsViewInputEvent event = events.getLast();
            assertEquals(moduleIndex, event.selectedModuleIndex(), "event carries selected module index");
            assertEquals(false, event.refreshRequested(), "module switch does not request refresh");
        }
    }

    private ToggleButton moduleButton(int moduleIndex) {
        String label = switch (moduleIndex) {
            case 1 -> "Fraktionen";
            case 2 -> "Locations";
            case 3 -> "Encounter Sources";
            default -> "NPCs";
        };
        return descendants(view()).stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .filter(button -> label.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Module button not found: " + label));
    }

    private WorldPlannerControlsView view() {
        if (view == null) {
            throw new IllegalStateException("World Planner controls view is not started.");
        }
        return view;
    }

    private static List<Node> descendants(Node node) {
        ArrayList<Node> nodes = new ArrayList<>();
        collect(node, nodes);
        return List.copyOf(nodes);
    }

    private static void collect(Node node, List<Node> nodes) {
        nodes.add(node);
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collect(child, nodes);
            }
        }
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            Platform.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX World Planner controls harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("World Planner controls raw-input harness failed.", failure[0]);
        }
    }

    private static void shutdownFx() throws Exception {
        if (!FX_STARTED.get()) {
            return;
        }
        runOnFxThread(() -> {
            for (Window window : List.copyOf(Window.getWindows())) {
                window.hide();
            }
            Platform.exit();
        });
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
