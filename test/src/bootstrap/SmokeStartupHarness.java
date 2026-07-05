package bootstrap;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import javafx.application.Platform;
import shell.api.ShellContribution;
import src.data.persistencecore.sqlite.SmokeStartupSqliteConnectionFactory;

public final class SmokeStartupHarness {

    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    private SmokeStartupHarness() {
    }

    public static void main(String[] args) throws Exception {
        Instant deadline = Instant.now().plus(TIMEOUT);
        Platform.startup(() -> {
        });
        try {
            List<ShellContribution> contributions = new ShellViewDiscovery().discover();
            require(!contributions.isEmpty(), "Expected at least one shell contribution.");
            require(hasContribution(contributions, "leftbartabs"), "Expected left-bar contributions.");
            require(hasContribution(contributions, "statetabs"), "Expected state-tab contributions.");
            require(hasContribution(contributions, "dropdowns"), "Expected top-bar/dropdown contributions.");
            new AppBootstrap().createShell();
            openTempSqliteConnection();
            require(Instant.now().isBefore(deadline), "Smoke startup exceeded timeout.");
            System.out.println("smokeStartupHarness passed: contributions=" + contributions.size());
        } finally {
            Platform.exit();
        }
    }

    private static boolean hasContribution(List<ShellContribution> contributions, String packageSegment) {
        return contributions.stream()
                .map(contribution -> contribution.getClass().getName())
                .anyMatch(name -> name.contains(".view." + packageSegment + "."));
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
