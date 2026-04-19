package bootstrap;

import java.io.IOException;
import java.io.InputStream;
import javafx.scene.image.Image;
import javafx.stage.Stage;
import org.jspecify.annotations.Nullable;

/**
 * Loads the generated runtime window icon once and applies it to JavaFX stages.
 */
final class DesktopWindowIcons {

    private static final String WINDOW_ICON_RESOURCE = "/icons/salt-marcher.png";

    private static @Nullable Image cachedIcon;
    private static boolean iconLookupAttempted;

    private DesktopWindowIcons() {
    }

    static void applyTo(Stage stage) {
        Image icon = loadWindowIcon();
        if (icon != null) {
            BootstrapFx.setWindowIcon(stage, icon);
        }
    }

    private static synchronized @Nullable Image loadWindowIcon() {
        if (iconLookupAttempted) {
            return cachedIcon;
        }

        iconLookupAttempted = true;
        try (InputStream stream = DesktopWindowIcons.class.getResourceAsStream(WINDOW_ICON_RESOURCE)) {
            if (stream != null) {
                cachedIcon = new Image(stream);
            }
        } catch (IOException | IllegalArgumentException ignored) {
            return null;
        }
        return cachedIcon;
    }
}
