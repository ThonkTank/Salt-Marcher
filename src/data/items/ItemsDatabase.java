package src.data.items;

import java.nio.file.Path;

public final class ItemsDatabase {

    public static final String FILE_NAME = "game.db";
    private static final String APP_DIRECTORY = "salt-marcher";

    private ItemsDatabase() {
    }

    public static Path resolvePath() {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome != null && !xdgDataHome.isBlank()) {
            return Path.of(xdgDataHome, APP_DIRECTORY, FILE_NAME).toAbsolutePath().normalize();
        }
        return Path.of(System.getProperty("user.home"), ".local", "share", APP_DIRECTORY, FILE_NAME)
                .toAbsolutePath()
                .normalize();
    }
}
