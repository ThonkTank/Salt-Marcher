package architecture;

import com.tngtech.archunit.core.importer.Location;
import com.tngtech.archunit.junit.LocationProvider;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;

public final class MainSourceLocationProvider implements LocationProvider {

    private static final Path MAIN_CLASSES_DIRECTORY = Paths.get("build", "classes", "java", "main");
    private static final String MAIN_CLASSES_PROPERTY = "saltmarcher.mainClassesDir";

    @Override
    public Set<Location> get(Class<?> testClass) {
        Path configuredMainClasses = Paths.get(
                System.getProperty(MAIN_CLASSES_PROPERTY, MAIN_CLASSES_DIRECTORY.toString()));
        Path mainClasses = configuredMainClasses.isAbsolute()
                ? configuredMainClasses.normalize()
                : Paths.get(System.getProperty("user.dir"))
                        .resolve(configuredMainClasses)
                        .normalize()
                        .toAbsolutePath();
        if (!Files.isDirectory(mainClasses)) {
            return Set.of();
        }
        return Set.of(Location.of(mainClasses));
    }
}
