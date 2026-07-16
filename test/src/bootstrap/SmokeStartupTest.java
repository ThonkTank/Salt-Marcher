package bootstrap;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.Pane;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import shell.host.AppShell;
import src.data.persistencecore.sqlite.SmokeStartupSqliteConnectionFactory;

@org.junit.jupiter.api.Tag("ui")
public final class SmokeStartupTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    private SmokeStartupTest() {
    }

    @AfterAll
    static void shutdownFx() {
        testsupport.JavaFxRuntime.shutdown();
    }

    @Test
    void SMOKE_STARTUP_001() throws Exception {
        Instant deadline = Instant.now().plus(TIMEOUT);
        testsupport.JavaFxRuntime.startup(() -> {
        });
        AppShell shell = new AppBootstrap().createShell();
        new Scene(shell, 1150, 700);
        shell.applyCss();
        shell.layout();
        require(!shell.lookupAll(".nav-btn").isEmpty(), "Expected composed navigation entries.");
        require(
                shell.lookup(".title-large") instanceof Label title && !title.getText().isBlank(),
                "Expected startup navigation to expose a titled workspace.");
        require(
                shell.lookup(".toolbar") instanceof Pane toolbar && toolbar.getChildren().size() > 2,
                "Expected at least one composed top-bar contribution.");
        require(hasReachableStateTabs(shell), "Expected composed state-tab entries on a navigable workspace.");
        openTempSqliteConnection();
        require(Instant.now().isBefore(deadline), "Smoke startup exceeded timeout.");
    }

    private static boolean hasReachableStateTabs(AppShell shell) {
        for (Node node : shell.lookupAll(".nav-btn")) {
            if (node instanceof ToggleButton button) {
                button.fire();
                shell.applyCss();
                shell.layout();
                if (!shell.lookupAll(".scene-tab").isEmpty()) {
                    return true;
                }
            }
        }
        return false;
    }

    private static void openTempSqliteConnection() throws Exception {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        require(xdgDataHome != null && !xdgDataHome.isBlank(), "XDG_DATA_HOME must point at a temp dir.");
        Path database = Path.of(xdgDataHome, "salt-marcher", "game.db").toAbsolutePath().normalize();
        Files.createDirectories(database.getParent());
        try (var connection = new SmokeStartupSqliteConnectionFactory(database).openConnection();
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
}
