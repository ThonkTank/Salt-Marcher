package app;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.Pane;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import shell.api.ContributionKey;
import shell.host.AppShell;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

@org.junit.jupiter.api.Tag("ui")
public final class SmokeStartupTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    private SmokeStartupTest() {
    }

    @AfterAll
    static void shutdownFx() throws Exception {
        runOnFx(testsupport.JavaFxRuntime::shutdown);
    }

    @Test
    void SMOKE_STARTUP_001() throws Exception {
        Instant deadline = Instant.now().plus(TIMEOUT);
        runOnFx(() -> {
            try (AppBootstrap bootstrap = new AppBootstrap()) {
                AppShell shell = bootstrap.createShell();
                new Scene(shell, 1150, 700);
                shell.applyCss();
                shell.layout();
                List<ToggleButton> navigation = navigationButtons(shell);
                require(
                        navigation.stream().map(Node::getAccessibleText).toList().equals(List.of(
                                "Szenen",
                                "Session Planner",
                                "Dungeon-Editor",
                                "Dungeon-Reise",
                                "Hex-Karte",
                                "Katalog")),
                        "Expected exact explicit navigation manifest in shell order.");
                require(
                        shell.lookup(".title-large") instanceof Label title
                                && "Dungeon-Editor".equals(title.getText()),
                        "Expected Dungeon-Editor as explicit default landing.");
                require(
                        navigation.stream().filter(ToggleButton::isSelected).map(Node::getAccessibleText).toList()
                                .equals(List.of("Dungeon-Editor")),
                        "Expected only the default landing navigation entry to be selected.");
                require(
                        shell.lookup(".toolbar") instanceof Pane toolbar && toolbar.getChildren().size() == 4,
                        "Expected title, spacer, and exactly two explicit top-bar contributions.");
                List<String> topBarTooltips = shell.lookupAll(".toolbar .button").stream()
                        .filter(Button.class::isInstance)
                        .map(Button.class::cast)
                        .map(Button::getTooltip)
                        .filter(java.util.Objects::nonNull)
                        .map(javafx.scene.control.Tooltip::getText)
                        .sorted()
                        .toList();
                require(topBarTooltips.equals(List.of(
                                "Adventuring-Day-Rechner öffnen",
                                "Party-Panel öffnen (Alt+P)")),
                        "Expected distinct Adventuring Day and Party top-bar surfaces, but was "
                                + topBarTooltips + ".");
                assertStateTabManifest(shell, navigation);
                require(Instant.now().isBefore(deadline), "Smoke startup exceeded timeout.");
            }
        });
        openTempSqliteConnection();
    }

    private static void runOnFx(ThrowingRunnable action) throws Exception {
        if (Platform.isFxApplicationThread()) {
            action.run();
            return;
        }
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        testsupport.JavaFxRuntime.startup(() -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                completed.countDown();
            }
        });
        if (!completed.await(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX smoke startup work.");
        }
        Throwable thrown = failure.get();
        if (thrown instanceof Exception exception) {
            throw exception;
        }
        if (thrown instanceof Error error) {
            throw error;
        }
        if (thrown != null) {
            throw new IllegalStateException("JavaFX smoke startup work failed.", thrown);
        }
    }

    private static List<ToggleButton> navigationButtons(AppShell shell) {
        require(shell.lookup(".nav-sidebar") instanceof Pane, "Expected public navigation sidebar surface.");
        Pane sidebar = (Pane) shell.lookup(".nav-sidebar");
        return sidebar.getChildrenUnmodifiable().stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .toList();
    }

    private static void assertStateTabManifest(AppShell shell, List<ToggleButton> navigation) {
        require(navigation.stream().anyMatch(button -> "Katalog".equals(button.getAccessibleText())),
                "Katalog navigation entry missing.");
        shell.navigateTo(new ContributionKey("catalog"));
        shell.applyCss();
        shell.layout();
        List<String> stateTabs = shell.lookupAll(".scene-tab").stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .sorted(Comparator.comparingDouble(button ->
                        button.localToScene(button.getBoundsInLocal()).getMinX()))
                .map(ToggleButton::getText)
                .toList();
        require(stateTabs.equals(List.of("Encounter", "Reise")),
                "Expected exact explicit state-tab manifest in shell order, but was " + stateTabs + ".");
    }

    private static void openTempSqliteConnection() throws Exception {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        require(xdgDataHome != null && !xdgDataHome.isBlank(), "XDG_DATA_HOME must point at a temp dir.");
        Path database = Path.of(xdgDataHome, "salt-marcher", "game.db").toAbsolutePath().normalize();
        Files.createDirectories(database.getParent());
        try (SqliteDatabase lifecycle = new SqliteDatabase(database, NoopDiagnostics.INSTANCE);
             var connection = lifecycle.connections("smoke").openConnection();
             var statement = connection.createStatement()) {
            try (var result = statement.executeQuery("PRAGMA integrity_check")) {
                require(result.next() && "ok".equalsIgnoreCase(result.getString(1)), "SQLite integrity check failed.");
            }
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalStateException(message);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
