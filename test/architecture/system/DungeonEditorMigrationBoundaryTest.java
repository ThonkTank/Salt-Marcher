package architecture.system;

import static org.junit.jupiter.api.Assertions.assertEquals;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.junit.ArchTest;
import java.util.Set;
import java.util.TreeSet;

/** Freezes the temporary Dungeon Editor JavaFX-to-Application migration debt. */
@AnalyzeMainClasses
public final class DungeonEditorMigrationBoundaryTest {

    private static final String JAVAFX_PACKAGE = "features.dungeon.adapter.javafx.";
    private static final String APPLICATION_PACKAGE = "features.dungeon.application.";

    // M1 deletes this complete ledger together with the JavaFX-to-Application exception.
    private static final Set<String> TEMPORARY_APPLICATION_CLIENTS = Set.of();

    private DungeonEditorMigrationBoundaryTest() {
    }

    @ArchTest
    static void dungeonEditorApplicationDebtCannotMoveOrGrow(JavaClasses classes) {
        Set<String> currentClients = new TreeSet<>();
        for (JavaClass source : classes) {
            if (!source.getPackageName().startsWith(JAVAFX_PACKAGE)) {
                continue;
            }
            boolean dependsOnApplication = source.getDirectDependenciesFromSelf().stream()
                    .anyMatch(dependency -> dependency.getTargetClass().getPackageName()
                            .startsWith(APPLICATION_PACKAGE));
            if (dependsOnApplication) {
                currentClients.add(topLevelClass(source).getName());
            }
        }

        assertEquals(
                new TreeSet<>(TEMPORARY_APPLICATION_CLIENTS),
                currentClients,
                "M1 migration debt changed: do not add or move JavaFX-to-Application clients; "
                        + "remove migrated clients from the ledger");
    }

    private static JavaClass topLevelClass(JavaClass javaClass) {
        JavaClass current = javaClass;
        while (current.getEnclosingClass().isPresent()) {
            current = current.getEnclosingClass().orElseThrow();
        }
        return current;
    }
}
