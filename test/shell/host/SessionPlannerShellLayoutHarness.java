package shell.host;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellLeftBarTabMode;
import src.view.leftbartabs.sessionplanner.SessionPlannerContribution;
import src.view.leftbartabs.sessionplanner.SessionPlannerControlsView;

public final class SessionPlannerShellLayoutHarness {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private SessionPlannerShellLayoutHarness() {
    }

    public static void main(String[] args) throws Exception {
        try {
            runOnFxThread(SessionPlannerShellLayoutHarness::runHarness);
            shutdownFx();
            System.out.println("Session Planner shell layout harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private static void runHarness() {
        ShellWorkspacePane workspace = new ShellWorkspacePane();
        ShellBinding binding = new SessionPlannerContribution().bind(
                new shell.api.ShellRuntimeContext(EmptyInspectorSink.INSTANCE, services()));
        workspace.showTab(ShellSlotContent.from(binding), ShellLeftBarTabMode.RUNTIME);

        Stage stage = new Stage();
        stage.setScene(new Scene(workspace, 1_120.0, 620.0));
        stage.show();
        layout(workspace);

        VBox controlsPanel = descendants(workspace).stream()
                .filter(VBox.class::isInstance)
                .map(VBox.class::cast)
                .filter(node -> node.getStyleClass().contains("control-panel"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Shell controls panel not found."));
        Parent contributionControls = descendants(controlsPanel).stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .filter(node -> node != controlsPanel)
                .filter(node -> VBox.getVgrow(node) == javafx.scene.layout.Priority.ALWAYS)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Growing contribution controls not found."));
        SessionPlannerControlsView plannerControls =
                descendant(controlsPanel, SessionPlannerControlsView.class);

        assertTrue(VBox.getVgrow(controlsPanel) == javafx.scene.layout.Priority.ALWAYS,
                "shell controls panel grows vertically");
        assertTrue(VBox.getVgrow(contributionControls) == javafx.scene.layout.Priority.ALWAYS,
                "inserted contribution controls grow vertically");
        assertTrue(controlsPanel.getMinHeight() != Region.USE_PREF_SIZE, "controls panel min height is not pref-capped");
        assertTrue(controlsPanel.getMaxHeight() != Region.USE_PREF_SIZE, "controls panel max height is not pref-capped");
        assertTrue(controlsPanel.getHeight() > 0.0, "controls panel receives visible height");
        assertTrue(plannerControls.getHeight() > 0.0, "planner scroll controls receive visible height");
        assertTrue(plannerControls.getHeight() <= controlsPanel.getHeight(),
                "planner scroll controls stay inside the shell controls panel");
        assertTrue(plannerControls.getVbarPolicy() != ScrollPane.ScrollBarPolicy.NEVER,
                "planner controls keep vertical scrolling available");

        ScrollPane stateScroll = descendants(workspace).stream()
                .filter(ScrollPane.class::isInstance)
                .map(ScrollPane.class::cast)
                .filter(node -> node.getStyleClass().contains("shell-state-scroll"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Shell state scroll pane not found."));
        assertTrue(stateScroll.getVbarPolicy() == ScrollPane.ScrollBarPolicy.AS_NEEDED,
                "shell state panel keeps vertical scrolling globally available");
        assertTrue(stateScroll.isFitToWidth(), "shell state panel scroll content fits available width");
    }

    private static ServiceRegistry services() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.creatures.CreaturesServiceContribution().register(builder);
        new src.data.encounter.EncounterServiceContribution().register(builder);
        new src.data.encountertable.EncounterTableServiceContribution().register(builder);
        new src.data.party.PartyServiceContribution().register(builder);
        new src.data.sessionplanner.SessionPlannerServiceContribution().register(builder);
        new src.domain.creatures.CreaturesServiceContribution().register(builder);
        new src.domain.encountertable.EncounterTableServiceContribution().register(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        new src.domain.encounter.EncounterServiceContribution().register(builder);
        new src.domain.sessionplanner.SessionPlannerServiceContribution().register(builder);
        return builder.build();
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static List<Node> descendants(Node node) {
        java.util.ArrayList<Node> result = new java.util.ArrayList<>();
        collect(node, result);
        return List.copyOf(result);
    }

    private static void collect(Node node, List<Node> result) {
        result.add(node);
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collect(child, result);
            }
        }
    }

    private static void layout(Parent parent) {
        parent.applyCss();
        parent.layout();
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
            throw new IllegalStateException("Timed out waiting for JavaFX Session Planner shell layout harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Session Planner shell layout harness failed.", failure[0]);
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

    private enum EmptyInspectorSink implements InspectorSink {
        INSTANCE;

        @Override
        public void push(InspectorEntrySpec entry) {
        }

        @Override
        public void clear() {
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return false;
        }
    }
}
