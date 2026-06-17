package src.view.leftbartabs.catalog;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.TableView;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.data.creatures.model.CreaturesPersistenceSchema;

public final class CatalogInitialLoadHarness {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private CatalogInitialLoadHarness() {
    }

    public static void main(String[] args) throws Exception {
        try {
            seedCreatureCatalog();
            runOnFxThread(CatalogInitialLoadHarness::assertCatalogInitialLoad);
            shutdownFx();
            System.out.println("Catalog initial-load harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private static void assertCatalogInitialLoad() {
        ServiceRegistry registry = services();
        ShellRuntimeContext context = new ShellRuntimeContext(EmptyInspectorSink.INSTANCE, registry);
        ShellBinding binding = new CatalogContribution().bind(context);
        CatalogControlsView controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, CatalogControlsView.class);
        CatalogMainView main = slot(binding, ShellSlot.COCKPIT_MAIN, CatalogMainView.class);

        Stage stage = new Stage();
        HBox root = new HBox(controls, main);
        stage.setScene(new Scene(root, 1_150.0, 700.0));
        stage.show();
        root.applyCss();
        root.layout();

        TableView<?> table = descendant(main, TableView.class);
        Label countLabel = descendants(main).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .filter(label -> label.getText().endsWith("Monster gefunden"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog count label not found."));

        assertTrue(!table.getItems().isEmpty(), "Catalog table did not receive initial DB-backed rows.");
        assertTrue("2 Monster gefunden".equals(countLabel.getText()),
                "Catalog count label did not reflect DB-backed total: " + countLabel.getText());
    }

    private static ServiceRegistry services() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.creatures.CreaturesServiceContribution().register(builder);
        new src.data.encounter.EncounterServiceContribution().register(builder);
        new src.data.encountertable.EncounterTableServiceContribution().register(builder);
        new src.data.party.PartyServiceContribution().register(builder);
        new src.domain.creatures.CreaturesServiceContribution().register(builder);
        new src.domain.encountertable.EncounterTableServiceContribution().register(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        new src.domain.encounter.EncounterServiceContribution().register(builder);
        return builder.build();
    }

    private static void seedCreatureCatalog() throws Exception {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome == null || xdgDataHome.isBlank()) {
            throw new IllegalStateException("XDG_DATA_HOME must isolate the Catalog initial-load DB.");
        }
        Path dataHome = Path.of(xdgDataHome);
        Path database = dataHome.resolve("salt-marcher").resolve(CreaturesPersistenceSchema.DATABASE_FILE_NAME);
        Files.createDirectories(database.getParent());
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
            throw new IllegalStateException("Timed out waiting for JavaFX Catalog harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Catalog initial-load harness failed.", failure[0]);
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
