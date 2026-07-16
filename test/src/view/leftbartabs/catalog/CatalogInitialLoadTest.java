package src.view.leftbartabs.catalog;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TableView;
import javafx.scene.control.ToggleButton;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import src.data.creatures.model.CreaturesPersistenceSchema;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.items.ItemsCatalogApi;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldPlannerReadStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;
import src.data.creatures.query.SqliteCreatureCatalogQueryAdapter;
import src.data.encountertable.query.SqliteEncounterTableCatalogAdapter;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

@org.junit.jupiter.api.Tag("ui")
public final class CatalogInitialLoadTest {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterEach
    void hideWindows() throws Exception {
        runOnFxThread(CatalogInitialLoadTest::hideOpenWindows);
    }

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        shutdownFx();
    }

    @Test
    void CATALOG_INITIAL_LOAD_001() throws Exception {
        seedCreatureCatalog();
        runOnFxThread(() -> {
            CatalogFixture fixture = setupCatalog();
            assertInitialCatalogRows(fixture.main(), "CATALOG-INITIAL-LOAD-001");
        });
    }

    @Test
    void CATALOG_INITIAL_LOAD_002() throws Exception {
        seedCreatureCatalog();
        runOnFxThread(() -> {
            CatalogFixture fixture = setupCatalog();
            assertInitialCatalogRows(fixture.main(), "setup catalog initial rows");
            assertWorldPlannerSourceControls(
                    fixture.runtime(),
                    fixture.controls(),
                    "CATALOG-INITIAL-LOAD-002");
        });
    }

    @Test
    void CATALOG_CONSOLIDATION_001() throws Exception {
        seedCreatureCatalog();
        runOnFxThread(() -> {
            CatalogFixture fixture = setupCatalog();
            List<String> tabs = descendants(fixture.controls()).stream()
                    .filter(ToggleButton.class::isInstance)
                    .map(ToggleButton.class::cast)
                    .filter(button -> button.getStyleClass().contains("catalog-content-tab"))
                    .map(ToggleButton::getText)
                    .toList();
            assertTrue(tabs.equals(List.of(
                            "Monster", "Items", "Encounter", "NPCs", "Fraktionen", "Orte", "Encounter-Tabellen")),
                    "Catalog content order changed: " + tabs);
            assertTrue("Katalog".equals(fixture.binding().title()), "Catalog shell title is Katalog");
            assertTrue(!fixture.binding().slotContent().containsKey(ShellSlot.COCKPIT_STATE),
                    "Catalog must leave the global Encounter state slot unclaimed");
        });
    }

    @Test
    void CATALOG_CONSOLIDATION_002() throws Exception {
        runOnFxThread(() -> {
            AtomicLong openedPlan = new AtomicLong();
            AtomicBoolean allowReplacement = new AtomicBoolean();
            SavedEncounterCatalogModule module = new SavedEncounterCatalogModule(
                    openedPlan::set,
                    savedPlans(),
                    unsavedEncounterState(),
                    allowReplacement::get);
            Parent main = (Parent) module.main();
            @SuppressWarnings("unchecked")
            javafx.scene.control.ListView<SavedEncounterPlanSummary> list =
                    descendant(main, javafx.scene.control.ListView.class);
            list.getSelectionModel().selectFirst();
            Button open = button(main, "Im Encounter öffnen");

            open.fire();
            assertTrue(openedPlan.get() == 0L, "Unsaved roster replacement must be cancellable");
            allowReplacement.set(true);
            open.fire();
            assertTrue(openedPlan.get() == 41L, "Confirmed Catalog open forwards the selected saved plan id");
        });
    }

    @Test
    void CATALOG_ITEMS_001() throws Exception {
        runOnFxThread(() -> {
            CapturingInspectorSink inspector = new CapturingInspectorSink();
            ItemsCatalogModule module = new ItemsCatalogModule(new FixtureItemsCatalog(), inspector);
            Parent main = (Parent) module.main();
            @SuppressWarnings("unchecked")
            javafx.scene.control.ListView<ItemsCatalogApi.ItemRow> list =
                    descendant(main, javafx.scene.control.ListView.class);
            assertTrue(list.getItems().size() == 1, "Items list renders the local read-only result");
            list.getSelectionModel().selectFirst();
            list.fireEvent(new KeyEvent(
                    KeyEvent.KEY_PRESSED, "", "", KeyCode.ENTER,
                    false, false, false, false));
            assertTrue(inspector.lastEntry != null, "Item selection opens Inspector detail");
            Parent detail = (Parent) inspector.lastEntry.contentSupplier().get();
            assertTrue(descendants(detail).stream()
                            .filter(Label.class::isInstance)
                            .map(Label.class::cast)
                            .anyMatch(label -> label.getText().contains("2014 SRD")),
                    "Item Inspector retains public-source attribution");
            boolean mutationAction = descendants(module.controls()).stream()
                    .filter(Button.class::isInstance)
                    .map(Button.class::cast)
                    .map(Button::getText)
                    .anyMatch(text -> List.of("Anlegen", "Bearbeiten", "Löschen", "Loot", "Zuweisen").contains(text));
            assertTrue(!mutationAction, "Items Catalog exposes no mutation or loot action");
        });
    }

    private static CatalogFixture setupCatalog() {
        CatalogTestRuntime runtime = services();
        ShellBinding binding = runtime.contribution(EmptyInspectorSink.INSTANCE).bind();
        Parent controlsRoot = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Parent mainRoot = slot(binding, ShellSlot.COCKPIT_MAIN, Parent.class);
        CatalogMainView main = descendant(mainRoot, CatalogMainView.class);

        Stage stage = new Stage();
        HBox root = new HBox(controlsRoot, mainRoot);
        stage.setScene(new Scene(root, 1_150.0, 700.0));
        stage.show();
        root.applyCss();
        root.layout();
        return new CatalogFixture(runtime, binding, controlsRoot, main);
    }

    private static void assertInitialCatalogRows(CatalogMainView main, String label) {
        TableView<?> table = descendant(main, TableView.class);
        Label countLabel = descendants(main).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .filter(candidate -> candidate.getText().endsWith("Monster gefunden"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog count label not found."));

        assertTrue(!table.getItems().isEmpty(), label + " Catalog table did not receive initial DB-backed rows.");
        assertTrue("2 Monster gefunden".equals(countLabel.getText()),
                label + " Catalog count label did not reflect DB-backed total: " + countLabel.getText());
    }

    private static CatalogTestRuntime services() {
        return CatalogTestRuntime.create(
                new SqliteCreatureCatalogQueryAdapter(),
                new SqliteEncounterTableCatalogAdapter(),
                new WorldPlannerSnapshotModel(CatalogInitialLoadTest::worldPlannerSnapshot, listener -> () -> { }));
    }

    private static void assertWorldPlannerSourceControls(CatalogTestRuntime runtime, Parent controls, String label) {
        Button factionButton = button(controls, "Fraktionen");
        factionButton.fire();
        CheckBox faction = popupDescendant(CheckBox.class, "Scarlet Knives");
        faction.fire();
        selectComboItem(comboBox(controls), "#501 | Old Gate");

        EncounterBuilderInputsModel inputsModel = runtime.builderInputs();
        assertTrue(inputsModel.current().worldFactionIds().equals(List.of(1L)),
                label + " Encounter builder did not receive selected World Planner faction ids: "
                        + inputsModel.current().worldFactionIds());
        assertTrue(inputsModel.current().worldLocationId() == 501L,
                label + " Encounter builder did not receive selected World Planner location id: "
                        + inputsModel.current().worldLocationId());
    }

    private static WorldPlannerSnapshot worldPlannerSnapshot() {
        return new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(),
                List.of(new WorldFactionSummary(1L, "Scarlet Knives", "", 301L, List.of(), List.of())),
                List.of(new WorldLocationSummary(501L, "Old Gate", "", List.of(1L), List.of(301L))),
                "");
    }

    private static SavedEncounterPlanListModel savedPlans() {
        return new SavedEncounterPlanListModel(
                () -> new SavedEncounterPlanListResult(
                        SavedEncounterPlanStatus.SUCCESS,
                        List.of(new SavedEncounterPlanSummary(41L, "Gate Ambush", "2 Kreaturen")),
                        ""),
                listener -> () -> { });
    }

    private static EncounterStateModel unsavedEncounterState() {
        EncounterStateSnapshot.BuilderPane builder = new EncounterStateSnapshot.BuilderPane(
                "", "Manuelles Encounter", EncounterStateSnapshot.ThresholdMeter.empty(),
                EncounterStateSnapshot.BuilderSettings.defaultSettings(), List.of(),
                List.of(new EncounterStateSnapshot.RosterCard(
                        1L, 0L, "Goblin", "1/4", 50, 15, "humanoid", "", 1)),
                false, true, false, false, true, true, false, null);
        EncounterStateSnapshot snapshot = new EncounterStateSnapshot(
                EncounterStateSnapshot.Mode.BUILDER,
                builder,
                EncounterStateSnapshot.InitiativePane.empty(),
                EncounterStateSnapshot.CombatPane.empty(),
                EncounterStateSnapshot.ResolutionPane.empty(),
                "");
        return new EncounterStateModel(() -> snapshot, listener -> () -> { });
    }

    private static void seedCreatureCatalog() throws Exception {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome == null || xdgDataHome.isBlank()) {
            throw new IllegalStateException("XDG_DATA_HOME must isolate the Catalog initial-load DB.");
        }
        Path dataHome = Path.of(xdgDataHome);
        Path database = dataHome.resolve("salt-marcher").resolve(CreaturesPersistenceSchema.DATABASE_FILE_NAME);
        Files.createDirectories(database.getParent());
        Files.deleteIfExists(database);
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + database);
                Statement statement = connection.createStatement()) {
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_BIOMES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_SUBTYPES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_ACTIONS_TABLE_SQL);
            statement.execute(
                    "INSERT INTO creatures (id, name, size, creature_type, alignment, cr, xp, hp, ac) "
                            + "VALUES (1, 'Aboleth', 'Large', 'Aberration', 'Lawful Evil', '10', 5900, 135, 17)");
            statement.execute(
                    "INSERT INTO creatures (id, name, size, creature_type, alignment, cr, xp, hp, ac) "
                            + "VALUES (2, 'Acolyte', 'Medium', 'Humanoid', 'Any Alignment', '1/4', 50, 9, 10)");
        }
    }

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Node node = binding.slotContent().get(slot);
        if (!type.isInstance(node)) {
            throw new AssertionError("Unexpected " + slot + " slot content: " + node);
        }
        return type.cast(node);
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static Button button(Parent parent, String textPrefix) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> button.getText() != null && button.getText().startsWith(textPrefix))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + textPrefix));
    }

    private static ComboBox<?> comboBox(Parent parent) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(comboBox -> comboBox.getItems().stream().anyMatch(
                        item -> "#501 | Old Gate".equals(itemText(comboBox, item))))
                .findFirst()
                .orElseThrow(() -> new AssertionError("World Planner location ComboBox not found."));
    }

    private static void selectComboItem(ComboBox<?> comboBox, String itemText) {
        for (Object item : comboBox.getItems()) {
            if (itemText.equals(itemText(comboBox, item))) {
                selectComboItemRaw(comboBox, item);
                return;
            }
        }
        throw new AssertionError("World Planner location item not found: " + itemText);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void selectComboItemRaw(ComboBox comboBox, Object item) {
        comboBox.getSelectionModel().select(item);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static String itemText(ComboBox comboBox, Object item) {
        return comboBox.getConverter() == null ? String.valueOf(item) : comboBox.getConverter().toString(item);
    }

    private static <T extends Node> T popupDescendant(Class<T> type, String text) {
        for (Window window : Window.getWindows()) {
            Scene scene = window.getScene();
            if (scene == null || scene.getRoot() == null) {
                continue;
            }
            for (Node node : descendants(scene.getRoot())) {
                if (type.isInstance(node) && textValue(node).contains(text)) {
                    return type.cast(node);
                }
            }
        }
        throw new AssertionError("Popup descendant not found: " + text);
    }

    private static String textValue(Node node) {
        if (node instanceof Button button) {
            return button.getText();
        }
        if (node instanceof CheckBox checkBox) {
            return checkBox.getText();
        }
        if (node instanceof Label label) {
            return label.getText();
        }
        return "";
    }

    private static List<Node> descendants(Node node) {
        java.util.ArrayList<Node> nodes = new java.util.ArrayList<>();
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
            throw new IllegalStateException("Timed out waiting for JavaFX Catalog test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Catalog initial-load test failed.", failure[0]);
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

    private record CatalogFixture(
            CatalogTestRuntime runtime,
            ShellBinding binding,
            Parent controls,
            CatalogMainView main
    ) {
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

    private static final class CapturingInspectorSink implements InspectorSink {
        private InspectorEntrySpec lastEntry;

        @Override
        public void push(InspectorEntrySpec entry) {
            lastEntry = entry;
        }

        @Override
        public void clear() {
            lastEntry = null;
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return lastEntry != null && java.util.Objects.equals(lastEntry.entryKey(), entryKey);
        }
    }

    private static final class FixtureItemsCatalog implements ItemsCatalogApi {
        private final ItemRow row = new ItemRow(
                "equipment:club", "Club", "Weapon", "Simple", false, "", false, 10, "1 sp");

        @Override
        public CompletionStage<ItemFilterOptions> loadFilterOptions() {
            return CompletableFuture.completedFuture(new ItemFilterOptions(
                    Status.SUCCESS, List.of("Weapon"), List.of("Simple"), List.of()));
        }

        @Override
        public CompletionStage<ItemPageResult> search(ItemQuery query) {
            return CompletableFuture.completedFuture(new ItemPageResult(Status.SUCCESS, List.of(row), 1, 50, 0));
        }

        @Override
        public CompletionStage<ItemDetailResult> loadDetail(String sourceKey) {
            ItemDetail detail = new ItemDetail(
                    row.sourceKey(), row.name(), row.category(), row.subcategory(), false, "", false,
                    row.costCp(), row.costDisplay(), 2.0, "1d4 bludgeoning", "", List.of("Light"),
                    "A wooden club.", "2014 SRD", "https://www.dnd5eapi.co/api/2014/equipment/club");
            return CompletableFuture.completedFuture(new ItemDetailResult(Status.SUCCESS, detail));
        }
    }
}
