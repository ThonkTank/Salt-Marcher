package testsupport;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

public final class IsolatedDataExtension implements BeforeAllCallback {

    @Override
    public void beforeAll(ExtensionContext context) throws IOException {
        String configured = System.getenv("XDG_DATA_HOME");
        if (configured == null || configured.isBlank()) {
            throw new IllegalStateException("Tests require an isolated XDG_DATA_HOME.");
        }
        Path xdgDataHome = Path.of(configured).toAbsolutePath().normalize();
        Path buildDirectory = Path.of("build").toAbsolutePath().normalize();
        if (!xdgDataHome.startsWith(buildDirectory)) {
            throw new IllegalStateException("Refusing to clean non-build test data: " + xdgDataHome);
        }
        Path applicationData = xdgDataHome.resolve("salt-marcher");
        if (Files.exists(applicationData)) {
            try (var paths = Files.walk(applicationData)) {
                paths.sorted(Comparator.reverseOrder()).forEach(IsolatedDataExtension::delete);
            }
        }
        Files.createDirectories(applicationData);
    }

    private static void delete(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not clean isolated test data: " + path, exception);
        }
    }
}
