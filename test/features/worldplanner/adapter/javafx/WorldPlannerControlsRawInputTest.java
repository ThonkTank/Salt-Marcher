package features.worldplanner.adapter.javafx;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ToggleButton;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

@TestMethodOrder(OrderAnnotation.class)
@org.junit.jupiter.api.Tag("ui")
public final class WorldPlannerControlsRawInputTest {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();
    private static WorldPlannerControlsRawInputTest test;

    private final WorldPlannerViewModel viewModel = new WorldPlannerViewModel(false);
    private final List<ControlsInput> events = new ArrayList<>();
    private WorldPlannerControlsView view;

    private WorldPlannerControlsRawInputTest() {
    }

    @BeforeAll
    static void startTest() throws Exception {
        test = new WorldPlannerControlsRawInputTest();
        runOnFxThread(test::start);
    }

    @AfterAll
    static void stopTest() throws Exception {
        shutdownFx();
    }

    @Test
    @Order(1)
    void WORLD_PLANNER_CONTROLS_RAW_INPUT_001() throws Exception {
        runOnFxThread(test::assertProjectionRenderDoesNotPublishInput);
    }

    @Test
    @Order(2)
    void WORLD_PLANNER_CONTROLS_RAW_INPUT_002() throws Exception {
        runOnFxThread(test::assertUserModuleSwitchesPublishOneInput);
    }

    @Test
    @Order(3)
    void WORLD_PLANNER_CONTROLS_RAW_INPUT_003() throws Exception {
        runOnFxThread(test::assertUserRefreshPublishesRefreshInput);
    }

    @Test
    @Order(4)
    void WORLD_PLANNER_CONTROLS_RAW_INPUT_004() throws IOException {
        assertStartupRefreshOwnedByViewModel();
    }

    private void start() {
        Platform.setImplicitExit(false);
        view = new WorldPlannerControlsView();
        viewModel.onControlsInput(view(), events::add);
        view().bind(viewModel);
        Stage stage = new Stage();
        stage.setScene(new Scene(view(), 620.0, 120.0));
        stage.show();
        view().applyCss();
        view().layout();
    }

    private void assertProjectionRenderDoesNotPublishInput() {
        for (int moduleIndex = 0; moduleIndex < 4; moduleIndex++) {
            events.clear();
            viewModel.activate(moduleIndex);
            view().applyCss();
            view().layout();
            assertEquals(0, events.size(), "projection render must not publish raw input for module " + moduleIndex);
            assertTrue(moduleButton(moduleIndex).isSelected(), "projection selects module " + moduleIndex);
        }
    }

    private void assertUserModuleSwitchesPublishOneInput() {
        for (int moduleIndex = 0; moduleIndex < 4; moduleIndex++) {
            viewModel.activate(0);
            events.clear();
            moduleButton(moduleIndex).fire();
            assertEquals(1, events.size(), "user module switch must publish one input for module " + moduleIndex);
            ControlsInput event = events.getLast();
            assertEquals(moduleIndex, event.selectedModuleIndex(), "event carries selected module index");
            assertEquals(false, event.refreshRequested(), "module switch does not request refresh");
        }
    }

    private void assertUserRefreshPublishesRefreshInput() {
        for (int moduleIndex = 0; moduleIndex < 4; moduleIndex++) {
            moduleButton(moduleIndex).fire();
            view().applyCss();
            view().layout();
            events.clear();
            refreshButton().fire();
            assertEquals(1, events.size(), "user refresh must publish one input for module " + moduleIndex);
            ControlsInput event = events.getLast();
            assertEquals(moduleIndex, event.selectedModuleIndex(), "refresh event carries active module index");
            assertEquals(true, event.refreshRequested(), "refresh control requests refresh");
        }
    }

    private static void assertStartupRefreshOwnedByViewModel() throws IOException {
        String binder = Files.readString(Path.of(
                "features/worldplanner/adapter/javafx/WorldPlannerBinder.java"));
        assertFalse(
                binder.contains("RefreshWorldPlannerCommand"),
                "Binder must not own World Planner startup refresh command construction");
        assertFalse(
                binder.contains(".refresh(new"),
                "Binder must not call World Planner refresh directly during startup");
        assertTrue(
                binder.contains("viewModel.activateRoot(worldPlanner::refresh"),
                "Binder must route startup refresh through the ViewModel activation boundary");

        String viewModel = Files.readString(Path.of(
                "features/worldplanner/adapter/javafx/WorldPlannerViewModel.java"));
        assertTrue(
                viewModel.contains("void activateRoot("),
                "World Planner startup refresh must be routed through explicit same-root activation intent");
        assertTrue(
                viewModel.contains("refreshSink.accept(new RefreshWorldPlannerCommand())"),
                "World Planner activation boundary must send the startup refresh command to the supplied refresh sink");
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

    private Button refreshButton() {
        return descendants(view()).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> "Aktualisieren".equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Refresh button not found."));
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

    private static void assertFalse(boolean condition, String message) {
        if (condition) {
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
            testsupport.JavaFxRuntime.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX World Planner controls test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("World Planner controls raw-input test failed.", failure[0]);
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
            testsupport.JavaFxRuntime.shutdown();
        });
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
