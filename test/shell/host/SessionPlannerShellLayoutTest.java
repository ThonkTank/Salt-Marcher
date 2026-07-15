package shell.host;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.ContentDisplay;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellContributionSpec;
import shell.api.ShellSlot;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellLeftBarTabMode;
import src.view.leftbartabs.catalog.CatalogContribution;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContribution;
import src.view.leftbartabs.dungeontravel.DungeonTravelContribution;
import src.view.leftbartabs.hexmap.HexMapContribution;
import src.view.leftbartabs.hexmap.HexMapControlsView;
import src.view.leftbartabs.hexmap.HexMapMainView;
import src.view.leftbartabs.sessionplanner.SessionPlannerContribution;
import src.view.leftbartabs.sessionplanner.SessionPlannerControlsView;
import src.view.leftbartabs.sessionplanner.SessionPlannerTimelineMainView;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;

@org.junit.jupiter.api.Tag("ui")
public final class SessionPlannerShellLayoutTest {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterEach
    void hideWindows() throws Exception {
        runOnFxThread(SessionPlannerShellLayoutTest::hideOpenWindows);
    }

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        shutdownFx();
    }

    @Test
    void SESSION_PLANNER_SHELL_LAYOUT_001() throws Exception {
        runOnFxThread(SessionPlannerShellLayoutTest::runTest);
    }

    private static void runTest() {
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
        SessionPlannerTimelineMainView plannerMain =
                descendant(workspace, SessionPlannerTimelineMainView.class);

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
        assertTrue(plannerMain.getVbarPolicy() != ScrollPane.ScrollBarPolicy.NEVER,
                "planner main keeps vertical scrolling available");
        assertTrue(plannerMain.isFitToWidth(), "planner main scroll content fits available width");
        assertTrue(descendants(plannerMain).stream()
                        .filter(Parent.class::isInstance)
                        .map(Parent.class::cast)
                        .anyMatch(node -> node.getStyleClass().contains("session-planner-setup-strip")),
                "planner main renders the compact setup strip in the main slot");
        assertTrue(descendants(plannerMain).stream()
                        .filter(Label.class::isInstance)
                        .map(Label.class::cast)
                        .anyMatch(label -> "0 / ca. 0 Szenen".equals(label.getText())),
                "planner main setup strip renders the compact scene target");

        ScrollPane stateScroll = descendants(workspace).stream()
                .filter(ScrollPane.class::isInstance)
                .map(ScrollPane.class::cast)
                .filter(node -> node.getStyleClass().contains("shell-state-scroll"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Shell state scroll pane not found."));
        assertTrue(stateScroll.getVbarPolicy() == ScrollPane.ScrollBarPolicy.AS_NEEDED,
                "shell state panel keeps vertical scrolling globally available");
        assertTrue(stateScroll.isFitToWidth(), "shell state panel scroll content fits available width");

        ShellNavigationSidebar sidebar = new ShellNavigationSidebar();
        registerSidebarTab(
                sidebar,
                new DungeonTravelContribution().registrationSpec(),
                "Dungeon-Reise",
                "/view/leftbartabs/dungeontravel/navigation-icon.svg");
        registerSidebarTab(
                sidebar,
                new SessionPlannerContribution().registrationSpec(),
                "Session Planner",
                "/view/leftbartabs/sessionplanner/navigation-icon.svg");
        registerSidebarTab(
                sidebar,
                new CatalogContribution().registrationSpec(),
                "Encounter-Planer",
                "/view/leftbartabs/catalog/navigation-icon.svg");
        registerSidebarTab(
                sidebar,
                new DungeonEditorContribution().registrationSpec(),
                "Dungeon-Editor",
                "/view/leftbartabs/dungeoneditor/navigation-icon.svg");
        registerSidebarTab(
                sidebar,
                new HexMapContribution().registrationSpec(),
                "Hex-Karte",
                "/view/leftbartabs/hexmap/navigation-icon.svg");
        layout(sidebar);

        List<Node> sidebarChildren = List.copyOf(sidebar.getChildren());
        long separatorCount = sidebarChildren.stream()
                .filter(node -> node instanceof Region region && region.getStyleClass().contains("nav-separator"))
                .count();
        assertTrue(separatorCount == 2, "sidebar inserts separators at mode boundaries");
        assertTrue(sidebarChildren.size() == 7, "sidebar renders five tabs and two separators");

        List<ToggleButton> navButtons = sidebarChildren.stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .toList();
        assertTrue(navButtons.size() == 5, "sidebar renders five navigation buttons");
        assertButton(navButtons.get(0), "Session Planner", false);
        assertButton(navButtons.get(1), "Dungeon-Editor", false);
        assertButton(navButtons.get(2), "Dungeon-Reise", false);
        assertButton(navButtons.get(3), "Hex-Karte", false);
        assertButton(navButtons.get(4), "Encounter-Planer", false);
        assertTrue(sidebarChildren.get(1).getStyleClass().contains("nav-separator"),
                "sidebar separates runtime and editor tabs");
        assertTrue(sidebarChildren.get(3).getStyleClass().contains("nav-separator"),
                "sidebar separates editor and runtime tabs");
        Node malformedGraphic = ShellNavigationGraphicLoader.load(
                shell.api.NavigationGraphicResource.of("/shell/host/malformed-navigation-icon.svg"));
        assertTrue(malformedGraphic.getStyleClass().contains("nav-icon-missing"),
                "malformed navigation resource uses missing graphic fallback");
        assertLoadedNavigationGraphic(
                "/view/leftbartabs/worldplanner/navigation-icon.svg",
                "World Planner navigation icon loads from its stable resource path");
        assertHexMapShellLayout();
    }

    private static ServiceRegistry services() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.creatures.CreaturesServiceContribution().register(builder);
        new src.data.encounter.EncounterServiceContribution().register(builder);
        new src.data.encountertable.EncounterTableServiceContribution().register(builder);
        new src.data.hex.HexServiceContribution().register(builder);
        new src.data.party.PartyServiceContribution().register(builder);
        new src.data.sessionplanner.SessionPlannerServiceContribution().register(builder);
        new src.domain.creatures.CreaturesServiceContribution().register(builder);
        new src.domain.encountertable.EncounterTableServiceContribution().register(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        new src.domain.encounter.EncounterServiceContribution().register(builder);
        new src.domain.hex.HexServiceContribution().register(builder);
        new src.domain.sessionplanner.SessionPlannerServiceContribution().register(builder);
        return builder.build();
    }

    private static void assertHexMapShellLayout() {
        ShellWorkspacePane workspace = new ShellWorkspacePane();
        ShellBinding binding = new HexMapContribution().bind(
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
                .orElseThrow(() -> new AssertionError("Hex shell controls panel not found."));
        CatalogCrudControlsView catalog = descendant(controlsPanel, CatalogCrudControlsView.class);
        HexMapControlsView controls = descendant(controlsPanel, HexMapControlsView.class);
        HexMapMainView main = descendant(workspace, HexMapMainView.class);
        Parent shellStack = descendants(controlsPanel).stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .filter(parent -> parent instanceof VBox)
                .filter(parent -> parent.getChildrenUnmodifiable().contains(catalog))
                .filter(parent -> parent.getChildrenUnmodifiable().contains(controls))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Hex ShellControls.stack VBox not found."));

        assertTrue(VBox.getVgrow(shellStack) == javafx.scene.layout.Priority.ALWAYS,
                "Hex shared controls stack grows inside shell controls panel");
        assertTrue(VBox.getVgrow(catalog) == null,
                "Hex shared catalog is fixed in the ShellControls stack");
        assertTrue(VBox.getVgrow(controls) == javafx.scene.layout.Priority.ALWAYS,
                "Hex compact controls are the flexible ShellControls stack child");
        assertTrue(controls.getStyleClass().contains("control-toolbar"),
                "Hex controls use the shared compact toolbar styling");
        assertTrue(main.getHeight() > 0.0, "Hex main map receives visible shell main area");
        assertTrue(main.getWidth() > 0.0, "Hex main map receives visible shell main width");
        stage.close();
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

    private static void registerSidebarTab(
            ShellNavigationSidebar sidebar,
            ShellContributionSpec contributionSpec,
            String title,
            String expectedGraphicPath
    ) {
        ShellLeftBarTabSpec tabSpec = (ShellLeftBarTabSpec) contributionSpec;
        assertTrue(tabSpec.navigationGraphic() != null
                        && expectedGraphicPath.equals(tabSpec.navigationGraphic().path()),
                "sidebar tab uses expected navigation resource for " + title);
        sidebar.registerLeftBarTab(
                tabSpec,
                new TestShellBinding(title),
                key -> {
                });
    }

    private static void assertButton(ToggleButton button, String title, boolean expectMissingGraphic) {
        assertTrue(button.getContentDisplay() == ContentDisplay.GRAPHIC_ONLY,
                "sidebar button uses icon-only content display for " + title);
        assertTrue(title.equals(button.getAccessibleText()),
                "sidebar button accessible text keeps the bound title for " + title);
        assertTrue(button.getTooltip() != null && title.equals(button.getTooltip().getText()),
                "sidebar button tooltip keeps the bound title for " + title);
        assertTrue(button.getGraphic() != null, "sidebar button graphic is present for " + title);
        boolean missingGraphic = button.getGraphic().getStyleClass().contains("nav-icon-missing");
        assertTrue(missingGraphic == expectMissingGraphic,
                "sidebar button missing-graphic state matches expectation for " + title);
    }

    private static void assertLoadedNavigationGraphic(String path, String message) {
        Node graphic = ShellNavigationGraphicLoader.load(shell.api.NavigationGraphicResource.of(path));
        assertTrue(!graphic.getStyleClass().contains("nav-icon-missing"), message);
        assertTrue(graphic instanceof Region region
                        && region.getPrefWidth() == 18.0
                        && region.getPrefHeight() == 18.0,
                "navigation graphic keeps fixed 18px layout for " + path);
        assertTrue(descendants(graphic).stream()
                        .anyMatch(node -> node.getStyleClass().contains("nav-icon-stroke")),
                "navigation graphic exposes themeable stroke nodes for " + path);
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
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
            throw new IllegalStateException("Timed out waiting for JavaFX Session Planner shell layout test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Session Planner shell layout test failed.", failure[0]);
        }
    }

    private static void shutdownFx() throws Exception {
        if (!FX_STARTED.get()) {
            return;
        }
        runOnFxThread(() -> {
            hideOpenWindows();
            testsupport.JavaFxRuntime.shutdown();
        });
    }

    private static void hideOpenWindows() {
        Platform.setImplicitExit(false);
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
        }
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

    private record TestShellBinding(String title) implements ShellBinding {

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of();
        }
    }
}
