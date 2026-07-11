package src.view.slotcontent.controls.searchfilter;

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
import javafx.scene.control.CheckBox;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.stage.Stage;
import javafx.stage.Window;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.published.CreateWorldNpcCommand;
import src.view.leftbartabs.worldplanner.WorldPlannerContribution;

public final class SearchFilterControlsHarness {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private SearchFilterControlsHarness() {
    }

    public static void main(String[] args) throws Exception {
        try {
            runOnFxThread(SearchFilterControlsHarness::runHarness);
            runOnFxThread(SearchFilterControlsHarness::assertWorldPlannerProductionRoute);
            shutdownFx();
            System.out.println("Search filter controls harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private static void runHarness() {
        SearchFilterControlsContentModel model = new SearchFilterControlsContentModel();
        SearchFilterControlsView view = new SearchFilterControlsView();
        List<SearchFilterControlsViewInputEvent> events = new ArrayList<>();
        view.onViewInputEvent(events::add);
        view.bind(model);
        Stage stage = new Stage();
        stage.setScene(new Scene(view, 520.0, 260.0));
        stage.show();
        view.applyCss();
        view.layout();

        model.applyProjection(projection("abo", List.of("undead", "beast")));
        view.applyCss();
        view.layout();
        assertTrue(events.isEmpty(), "projection render does not emit input");

        TextField search = descendant(view, TextField.class);
        search.setText("acolyte");
        view.applyCss();
        view.layout();
        assertEquals(1, events.size(), "user search edit emits one input event");
        assertEquals("acolyte", events.getLast().searchQuery(), "user search event carries raw query");

        events.clear();
        button(view, "Leeren").fire();
        view.applyCss();
        view.layout();
        assertEquals(1, events.size(), "clear-all emits one final input event");
        assertEquals("", events.getLast().searchQuery(), "clear-all clears query");
        assertTrue(events.getLast().selectedFilters().isEmpty(), "clear-all clears selected filters");

        model.applyProjection(projection("beast", List.of("undead", "beast")));
        view.applyCss();
        view.layout();
        events.clear();
        buttonByAccessibleText(view, "Filter entfernen: Undead").fire();
        view.applyCss();
        view.layout();
        assertEquals(1, events.size(), "chip removal emits one final input event");
        SearchFilterControlsViewInputEvent event = events.getLast();
        assertEquals("beast", event.searchQuery(), "chip removal preserves query");
        assertEquals(
                List.of(new SearchFilterControlsViewInputEvent.SelectedFilter("type", "beast")),
                event.selectedFilters(),
                "chip removal clears only the matching filter");
    }

    private static void assertWorldPlannerProductionRoute() {
        ServiceRegistry services = worldPlannerServices();
        ShellBinding binding = new WorldPlannerContribution().bind(
                new ShellRuntimeContext(EmptyInspectorSink.INSTANCE, services));
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Parent main = slot(binding, ShellSlot.COCKPIT_MAIN, Parent.class);
        Stage stage = new Stage();
        stage.setScene(new Scene(new javafx.scene.layout.HBox(controls, main), 1_120.0, 620.0));
        stage.show();
        layoutOpenWindows();

        services.require(WorldPlannerApplicationService.class).createNpc(new CreateWorldNpcCommand(
                "Captain Vale",
                101L,
                "scarred",
                "watchful",
                "former scout",
                "knows the pass"));
        layoutOpenWindows();

        TextField search = descendant(descendant(controls, SearchFilterControlsView.class), TextField.class);
        search.setText("Captain");
        layoutOpenWindows();
        assertTrue(listView(main).getItems().stream().anyMatch(item -> item.toString().contains("Captain Vale")),
                "WorldPlannerContribution production route keeps matching row through SearchFilter controls");
        search.setText("missing");
        layoutOpenWindows();
        assertTrue(listView(main).getItems().isEmpty(),
                "WorldPlannerContribution production route filters nonmatching rows through SearchFilter controls");
        stage.close();
    }

    private static ServiceRegistry worldPlannerServices() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(WorldPlannerReferencePort.class, new PositiveReferencePort());
        new src.data.worldplanner.WorldPlannerServiceContribution().register(builder);
        new src.domain.worldplanner.WorldPlannerServiceContribution().register(builder);
        return builder.build();
    }

    private static SearchFilterControlsContentModel.Projection projection(
            String query,
            List<String> selectedOptions
    ) {
        return new SearchFilterControlsContentModel.Projection(
                "Monster suchen",
                query,
                List.of(new SearchFilterControlsContentModel.FilterGroup(
                        "type",
                        "Typ",
                        List.of(
                                option("undead", "Undead", selectedOptions),
                                option("beast", "Beast", selectedOptions),
                                option("dragon", "Dragon", selectedOptions)))),
                selectedOptions.stream()
                        .map(option -> new SearchFilterControlsContentModel.FilterChip(
                                "type",
                                option,
                                label(option)))
                        .toList());
    }

    private static SearchFilterControlsContentModel.FilterOption option(
            String key,
            String label,
            List<String> selectedOptions
    ) {
        return new SearchFilterControlsContentModel.FilterOption(key, label, selectedOptions.contains(key));
    }

    private static String label(String option) {
        return switch (option) {
            case "undead" -> "Undead";
            case "beast" -> "Beast";
            case "dragon" -> "Dragon";
            default -> option;
        };
    }

    private static Button button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static Button buttonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + accessibleText));
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Node node = binding.slotContent().get(slot);
        if (type.isInstance(node)) {
            return type.cast(node);
        }
        throw new AssertionError("Shell slot not found: " + slot);
    }

    @SuppressWarnings("unchecked")
    private static ListView<Object> listView(Parent parent) {
        return descendants(parent).stream()
                .filter(ListView.class::isInstance)
                .map(node -> (ListView<Object>) node)
                .findFirst()
                .orElseThrow(() -> new AssertionError("ListView not found."));
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

    private static void layoutOpenWindows() {
        for (Window window : Window.getWindows()) {
            Scene scene = window.getScene();
            if (scene != null && scene.getRoot() != null) {
                scene.getRoot().applyCss();
                scene.getRoot().layout();
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
            throw new IllegalStateException("Timed out waiting for JavaFX SearchFilter harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("SearchFilter controls harness failed.", failure[0]);
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

    private static final class PositiveReferencePort implements WorldPlannerReferencePort {

        @Override
        public boolean creatureStatblockExists(long creatureStatblockId) {
            return creatureStatblockId > 0L;
        }

        @Override
        public boolean encounterTableExists(long encounterTableId) {
            return encounterTableId > 0L;
        }
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
