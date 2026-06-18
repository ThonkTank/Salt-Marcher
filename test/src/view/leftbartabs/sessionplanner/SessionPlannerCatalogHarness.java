package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
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
import javafx.scene.control.ButtonBase;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.data.sessionplanner.mapper.SessionPlanMapper;
import src.data.sessionplanner.model.SessionEncounterRecord;
import src.data.sessionplanner.model.SessionLootPlaceholderRecord;
import src.data.sessionplanner.model.SessionPlanRecord;
import src.data.sessionplanner.model.SessionPlanSnapshotRecord;
import src.domain.sessionplanner.model.session.EncounterDays;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCatalogSnapshot;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;

public final class SessionPlannerCatalogHarness {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private SessionPlannerCatalogHarness() {
    }

    public static void main(String[] args) throws Exception {
        try {
            runOnFxThread(SessionPlannerCatalogHarness::runHarness);
            shutdownFx();
            System.out.println("Session Planner catalog harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private static void runHarness() {
        ServiceRegistry services = services();
        ShellRuntimeContext context = new ShellRuntimeContext(EmptyInspectorSink.INSTANCE, services);
        ShellBinding binding = new SessionPlannerContribution().bind(context);
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Parent main = slot(binding, ShellSlot.COCKPIT_MAIN, Parent.class);
        Parent state = slot(binding, ShellSlot.COCKPIT_STATE, Parent.class);
        SessionPlannerCatalogModel catalog = services.require(SessionPlannerCatalogModel.class);
        SessionPlannerCurrentSessionModel current = services.require(SessionPlannerCurrentSessionModel.class);

        Stage stage = new Stage();
        HBox root = new HBox(controls, main, state);
        stage.setScene(new Scene(root, 1_260.0, 760.0));
        stage.show();
        layout(root);

        assertControlsUseCompactPartySelector(controls);
        assertEncounterLootTargetsEncounterCards();
        assertCatalogSize(catalog.current(), 0, "initial catalog is empty");
        assertTrue(!hasLabel(controls, "Session #0"), "initial controls do not show default Session #0");
        assertTrue(hasLabel(controls, "Keine Session"), "initial controls show empty session state");
        assertTrue(button(controls, "Tage setzen").isDisabled(), "initial controls disable session mutation");
        encounterDaysField(controls).setText("2");
        button(controls, "Tage setzen").fire();
        assertCatalogSize(catalog.current(), 0, "session-bound action before create does not seed a session");

        createSession(controls, "Alpha");
        SessionPlannerCatalogSnapshot afterAlpha = catalog.current();
        assertCatalogSize(afterAlpha, 1, "create adds first session");
        long alphaId = only(afterAlpha).sessionId();
        assertEquals("Alpha", only(afterAlpha).displayName(), "create stores display name");
        assertEquals(alphaId, afterAlpha.selectedSessionId(), "create selects new session");
        assertEquals("Alpha", current.current().session().displayName(), "current session display name after create");

        encounterDaysField(controls).setText("2");
        button(controls, "Tage setzen").fire();
        assertEquals("2", current.current().session().encounterDaysText(), "session content mutation before rename");

        renameSelectedSession(controls, "Alpha Prime");
        SessionPlannerSessionSnapshot renamedCurrent = current.current();
        assertEquals("Alpha Prime", renamedCurrent.session().displayName(), "rename updates display name");
        assertEquals("2", renamedCurrent.session().encounterDaysText(), "rename preserves session content");

        createSession(controls, "Beta");
        SessionPlannerCatalogSnapshot afterBeta = catalog.current();
        assertCatalogSize(afterBeta, 2, "second create adds catalog row");
        long betaId = afterBeta.selectedSessionId();
        assertEquals("Beta", current.current().session().displayName(), "second create selects Beta");

        selectSession(controls, alphaId);
        assertEquals(alphaId, catalog.current().selectedSessionId(), "select updates catalog selected id");
        assertEquals("Alpha Prime", current.current().session().displayName(), "select loads renamed session");
        assertEquals("2", current.current().session().encounterDaysText(), "select preserves renamed session content");

        deleteSelectedSession(controls);
        SessionPlannerCatalogSnapshot afterDeleteAlpha = catalog.current();
        assertCatalogSize(afterDeleteAlpha, 1, "delete removes selected session");
        assertEquals(betaId, afterDeleteAlpha.selectedSessionId(), "delete falls back to remaining stable session");
        assertEquals("Beta", current.current().session().displayName(), "delete fallback loads remaining session");

        deleteSelectedSession(controls);
        SessionPlannerCatalogSnapshot afterDeleteLast = catalog.current();
        assertCatalogSize(afterDeleteLast, 1, "delete last session seeds replacement session");
        assertTrue(afterDeleteLast.selectedSessionId() > 0L, "replacement session uses a stable id");
        assertEquals(afterDeleteLast.selectedSessionId(), current.current().session().sessionId(),
                "replacement session is current");
        assertTrue(!"Beta".equals(current.current().session().displayName()), "replacement session is seeded");

        createSession(controls, "Gamma");
        SessionPlannerCatalogSnapshot afterCreatePostDelete = catalog.current();
        assertCatalogSize(afterCreatePostDelete, 2, "create after delete-last adds a new session");
        assertEquals("Gamma", current.current().session().displayName(), "create after delete-last selects Gamma");
        assertTrue(afterCreatePostDelete.sessions().stream().anyMatch(session -> "Gamma".equals(session.displayName())),
                "create after delete-last publishes Gamma");
    }

    private static void createSession(Parent controls, String name) {
        firePrimaryAction(controls);
        popupTextField(controls, "Dungeon-Name").setText(name);
        popupButton(controls, "Erstellen").fire();
        layout(controls);
    }

    private static void renameSelectedSession(Parent controls, String name) {
        actionMenuItem(controls, "Umbenennen").fire();
        TextField draft = popupTextField(controls, "Dungeon-Name");
        assertTrue(!draft.getText().isBlank(), "rename preloads selected session name");
        draft.setText(name);
        popupButton(controls, "Speichern").fire();
        layout(controls);
    }

    private static void selectSession(Parent controls, long sessionId) {
        @SuppressWarnings("unchecked")
        ComboBox<String> selector = (ComboBox<String>) descendant(controls, ComboBox.class);
        selector.getSelectionModel().select(Long.toString(sessionId));
        layout(controls);
        button(controls, "Öffnen").fire();
        layout(controls);
    }

    private static void deleteSelectedSession(Parent controls) {
        actionMenuItem(controls, "Löschen").fire();
        popupButtonByAccessibleText(controls, "Löschen bestätigen").fire();
        layout(controls);
    }

    private static void assertControlsUseCompactPartySelector(Parent controls) {
        long selectorCount = descendants(controls).stream()
                .filter(ComboBox.class::isInstance)
                .count();
        assertTrue(selectorCount >= 2L, "controls expose catalog selector and compact party selector");
        assertTrue(button(controls, "Hinzufuegen").isDisabled(), "compact party add button starts disabled");
    }

    private static void assertEncounterLootTargetsEncounterCards() {
        SessionPlan plan = SessionPlan.seeded(77L, List.of(), EncounterDays.one())
                .attachEncounter(101L)
                .attachEncounter(202L)
                .addLootPlaceholder(1L)
                .addLootPlaceholder(2L)
                .addLootPlaceholder(1L);
        assertEquals(Integer.valueOf(3), Integer.valueOf(plan.lootPlaceholders().size()),
                "loot placeholders are stored on the session plan");
        assertEquals(Long.valueOf(1L), Long.valueOf(plan.lootPlaceholders().get(0).encounterId()),
                "first loot placeholder stores its encounter target");
        assertEquals(Long.valueOf(2L), Long.valueOf(plan.lootPlaceholders().get(1).encounterId()),
                "second loot placeholder stores its encounter target");

        SessionPlan afterRemoval = plan.removeEncounter(1L);
        assertEquals(Integer.valueOf(1), Integer.valueOf(afterRemoval.lootPlaceholders().size()),
                "removing an encounter prunes its loot placeholders");
        assertEquals(Long.valueOf(2L), Long.valueOf(afterRemoval.lootPlaceholders().getFirst().encounterId()),
                "remaining loot placeholder keeps the surviving encounter target");
        assertLegacyLootLoadsIntoFirstEncounter();

        SessionPlannerEncountersProjection projection = new SessionPlannerEncountersProjection(
                List.of(new SessionPlannerEncountersProjection.PlannedEncounter(
                        1L,
                        101L,
                        "Crypt",
                        "",
                        2,
                        100,
                        150,
                        1.5,
                        "Medium",
                        BigDecimal.valueOf(50L),
                        200,
                        false,
                        List.of(new SessionPlannerEncountersProjection.LootPlaceholder(10L, "Cache")))),
                List.of());
        SessionPlannerTimelineMainContentModel contentModel = new SessionPlannerTimelineMainContentModel();
        contentModel.applyEncounters(projection);
        assertEquals(Integer.valueOf(1), Integer.valueOf(
                        contentModel.projectionProperty().get().encounters().getFirst().lootPlaceholders().size()),
                "timeline model keeps loot inside the encounter card");

        SessionPlannerTimelineMainView view = new SessionPlannerTimelineMainView();
        List<SessionPlannerTimelineMainViewInputEvent> events = new ArrayList<>();
        view.onViewInputEvent(events::add);
        view.bind(contentModel);
        Stage stage = new Stage();
        stage.setScene(new Scene(view, 520.0, 420.0));
        stage.show();
        layout(view);
        assertTrue(hasLabel(view, "Cache"), "timeline view renders encounter loot");
        button(view, "Loot-Platzhalter").fire();
        assertEquals(Integer.valueOf(1), Integer.valueOf(events.size()), "loot add button publishes one event");
        assertEquals(Long.valueOf(1L), Long.valueOf(events.getFirst().lootEncounterTokenToAdd()),
                "loot add event targets the encounter card");
        stage.hide();
    }

    private static void assertLegacyLootLoadsIntoFirstEncounter() {
        SessionPlan loaded = SessionPlanMapper.toDomain(new SessionPlanSnapshotRecord(
                new SessionPlanRecord(88L, "Legacy", "1.0", 1L, "", 3L, 2L),
                List.of(),
                List.of(new SessionEncounterRecord(1L, 101L, "100", 0)),
                List.of(),
                List.of(new SessionLootPlaceholderRecord(1L, 0L, "Legacy Cache", 0))));
        assertEquals(Long.valueOf(1L), Long.valueOf(loaded.lootPlaceholders().getFirst().encounterId()),
                "legacy loot without encounter id loads into the first encounter");
    }

    private static TextField encounterDaysField(Parent controls) {
        return descendants(controls).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> "1.0".equals(field.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Encounter days field not found."));
    }

    private static SessionPlannerCatalogSnapshot.SessionSummary only(SessionPlannerCatalogSnapshot snapshot) {
        if (snapshot.sessions().size() != 1) {
            throw new AssertionError("Expected one session, got " + snapshot.sessions().size());
        }
        return snapshot.sessions().getFirst();
    }

    private static void assertCatalogSize(SessionPlannerCatalogSnapshot snapshot, int expected, String message) {
        assertEquals(Integer.valueOf(expected), Integer.valueOf(snapshot.sessions().size()), message);
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

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Node node = binding.slotContent().get(slot);
        if (!type.isInstance(node)) {
            throw new AssertionError("Unexpected " + slot + " slot content: " + node);
        }
        return type.cast(node);
    }

    private static Button button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static void firePrimaryAction(Parent parent) {
        button(parent, "Neu").fire();
    }

    private static MenuButton actionButton(Parent parent) {
        return descendants(parent).stream()
                .filter(MenuButton.class::isInstance)
                .map(MenuButton.class::cast)
                .filter(button -> "Mehr".equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("MenuButton not found: Mehr"));
    }

    private static javafx.scene.control.MenuItem actionMenuItem(Parent parent, String text) {
        return actionButton(parent).getItems().stream()
                .filter(item -> text.equals(item.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("MenuItem not found: " + text));
    }

    private static ButtonBase popupButton(Parent parent, String text) {
        return descendants(operationPopupContent(parent)).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog popup button not found: " + text));
    }

    private static TextField popupTextField(Parent parent, String accessibleText) {
        return descendants(operationPopupContent(parent)).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> accessibleText.equals(field.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog popup TextField not found: " + accessibleText));
    }

    private static ButtonBase popupButtonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(operationPopupContent(parent)).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog popup button not found: " + accessibleText));
    }

    private static Parent operationPopupContent(Parent parent) {
        Object content = parent.getProperties().get("catalogCrudOperationContent");
        if (content instanceof Parent popupContent) {
            return popupContent;
        }
        for (Node node : descendants(parent)) {
            Object nestedContent = node.getProperties().get("catalogCrudOperationContent");
            if (nestedContent instanceof Parent popupContent) {
                return popupContent;
            }
        }
        throw new AssertionError("Catalog popup content not found.");
    }

    private static boolean hasLabel(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> text.equals(label.getText()));
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

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + ": expected=" + expected + ", actual=" + actual);
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
            throw new IllegalStateException("Timed out waiting for JavaFX Session Planner harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Session Planner catalog harness failed.", failure[0]);
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
