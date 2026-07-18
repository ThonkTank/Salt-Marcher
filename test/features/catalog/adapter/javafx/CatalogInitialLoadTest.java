package features.catalog.adapter.javafx;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.concurrent.CountDownLatch;
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
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;
import features.encounter.api.EncounterBuilderInputsModel;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcLifecycleStatus;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.catalog.application.CatalogSectionId;
import features.encountertable.adapter.sqlite.query.SqliteEncounterTableCatalogAdapter;
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
            org.junit.jupiter.api.Assertions.assertEquals(
                    List.of("Monster", "Items", "Encounter", "NPCs", "Fraktionen", "Orte", "Encounter-Tabellen"),
                    fixture.controls().sectionTitles());
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
    void CATALOG_MONSTER_TABLE_001_keepsColumnsAndSelectionAcrossRefresh() throws Exception {
        seedCreatureCatalog();
        runOnFxThread(() -> {
            CatalogFixture fixture = setupCatalog();
            TableView<?> table = descendant(fixture.main(), TableView.class);
            table.getSelectionModel().selectFirst();
            CatalogMainContentModel.CatalogRow selected =
                    (CatalogMainContentModel.CatalogRow) table.getSelectionModel().getSelectedItem();
            List<?> columns = List.copyOf(table.getColumns());

            descendants(fixture.controls()).stream()
                    .filter(javafx.scene.control.TextField.class::isInstance)
                    .map(javafx.scene.control.TextField.class::cast)
                    .findFirst()
                    .orElseThrow()
                    .setText("Abo");

            assertTrue(table.getColumns().size() == columns.size(), "Monster column count changed on refresh.");
            for (int index = 0; index < columns.size(); index++) {
                assertTrue(table.getColumns().get(index) == columns.get(index),
                        "Monster column identity changed on refresh at index " + index);
            }
            assertTrue(((CatalogMainContentModel.CatalogRow) table.getSelectionModel().getSelectedItem()).id()
                            == selected.id(),
                    "Monster selection was not preserved by creature id.");
        });
    }

    @Test
    void CATALOG_WORLD_ROUTES_001() throws Exception {
        seedCreatureCatalog();
        AtomicBoolean createRequested = new AtomicBoolean();
        AtomicLong openedNpc = new AtomicLong();
        runOnFxThread(() -> {
            WorldPlannerSnapshotModel world = new WorldPlannerSnapshotModel(
                    CatalogInitialLoadTest::worldPlannerSnapshotWithNpc,
                    listener -> () -> { });
            CatalogTestRuntime runtime = CatalogTestRuntime.create(
                    new SqliteCreatureCatalogQueryAdapter(),
                    new SqliteEncounterTableCatalogAdapter(),
                    world);
            ShellBinding binding = runtime.contribution(
                    EmptyInspectorSink.INSTANCE,
                    openedNpc::set,
                    () -> createRequested.set(true)).bind();
            binding.onActivate();
            CatalogControlsHost controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, CatalogControlsHost.class);
            CatalogContentHost content = slot(binding, ShellSlot.COCKPIT_MAIN, CatalogContentHost.class);
            Stage stage = new Stage();
            HBox root = new HBox(controls, content);
            stage.setScene(new Scene(root, 900.0, 650.0));
            stage.show();
            root.applyCss();
            root.layout();

            controls.select(CatalogSectionId.NPCS);
            Button create = button(controls, "NPC anlegen");
            create.fire();

            TableView<?> npcs = descendant(content, TableView.class);
            npcs.getSelectionModel().selectFirst();
            npcs.fireEvent(new KeyEvent(
                    KeyEvent.KEY_PRESSED, "", "", KeyCode.ENTER,
                    false, false, false, false));

            assertTrue(createRequested.get(), "NPC creation route was not reachable from an empty Catalog section.");
            assertTrue(openedNpc.get() == 77L, "Enter did not open the selected provider-owned NPC inspector.");
        });
    }

    @Test
    void CATALOG_WORKSPACE_001_usesOneSectionRailAndPreservesSectionState() throws Exception {
        seedCreatureCatalog();
        runOnFxThread(() -> {
            CatalogFixture fixture = setupCatalog();
            CatalogControlsHost controls = fixture.controls();
            CatalogContentHost content = fixture.workspace();

            controls.select(CatalogSectionId.ITEMS);
            Node itemsContent = content.getCenter();
            javafx.scene.control.TextField itemSearch = descendants(controls).stream()
                    .filter(javafx.scene.control.TextField.class::isInstance)
                    .map(javafx.scene.control.TextField.class::cast)
                    .filter(field -> "Item-Name".equals(field.getAccessibleText()))
                    .findFirst()
                    .orElseThrow();
            itemSearch.setText("rapier");

            for (String title : controls.sectionTitles()) {
                controls.select(java.util.Arrays.stream(CatalogSectionId.values())
                        .filter(id -> id.label().equals(title)).findFirst().orElseThrow());
                assertTrue(content.getCenter() != null, title + " has no main-slot content.");
            }

            controls.select(CatalogSectionId.ITEMS);
            assertTrue(content.getCenter() == itemsContent, "Items content was recreated after section switches.");
            javafx.scene.control.TextField restoredSearch = descendants(controls).stream()
                    .filter(javafx.scene.control.TextField.class::isInstance)
                    .map(javafx.scene.control.TextField.class::cast)
                    .filter(field -> "Item-Name".equals(field.getAccessibleText()))
                    .findFirst()
                    .orElseThrow();
            assertTrue(restoredSearch == itemSearch && "rapier".equals(restoredSearch.getText()),
                    "Items controls did not preserve their draft state.");
        });
    }

    @Test
    void CATALOG_SCENE_ROUTE_001() throws Exception {
        seedCreatureCatalog();
        AtomicLong addedCreature = new AtomicLong();
        runOnFxThread(() -> {
            CatalogTestRuntime runtime = services();
            ShellBinding binding = runtime.contribution(
                    EmptyInspectorSink.INSTANCE, ignored -> { }, () -> { }, addedCreature::set).bind();
            binding.onActivate();
            CatalogContentHost workspace = slot(binding, ShellSlot.COCKPIT_MAIN, CatalogContentHost.class);
            CatalogMainView monsters = descendant(workspace, CatalogMainView.class);
            Stage stage = new Stage();
            stage.setScene(new Scene(workspace, 1_100.0, 700.0));
            stage.show();
            workspace.applyCss();
            workspace.layout();

            TableView<?> table = descendant(monsters, TableView.class);
            table.getSelectionModel().selectFirst();
            button(monsters, "+ Scene").fire();
            assertTrue(addedCreature.get() > 0L, "Monster + Scene did not publish the selected creature id.");
        });
    }

    private static CatalogFixture setupCatalog() {
        CatalogTestRuntime runtime = services();
        ShellBinding binding = runtime.contribution(EmptyInspectorSink.INSTANCE).bind();
        binding.onActivate();
        CatalogControlsHost controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, CatalogControlsHost.class);
        CatalogContentHost workspace = slot(binding, ShellSlot.COCKPIT_MAIN, CatalogContentHost.class);
        CatalogMainView main = descendant(workspace, CatalogMainView.class);

        Stage stage = new Stage();
        HBox root = new HBox(controls, workspace);
        stage.setScene(new Scene(root, 1_150.0, 700.0));
        stage.show();
        root.applyCss();
        root.layout();
        return new CatalogFixture(runtime, controls, workspace, main);
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

    private static WorldPlannerSnapshot worldPlannerSnapshotWithNpc() {
        return new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(new WorldNpcSummary(
                        77L, "Mira", 1L, "", "", "", "", WorldNpcLifecycleStatus.ACTIVE)),
                List.of(),
                List.of(),
                "");
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
            CatalogControlsHost controls,
            CatalogContentHost workspace,
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
}
