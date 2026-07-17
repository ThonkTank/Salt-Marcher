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
    private static final Set<String> TEMPORARY_APPLICATION_CLIENTS = Set.of(
            "features.dungeon.adapter.javafx.editor.DungeonEditorBinder",
            "features.dungeon.adapter.javafx.editor.DungeonEditorContribution",
            "features.dungeon.adapter.javafx.editor.DungeonEditorControlsInput",
            "features.dungeon.adapter.javafx.editor.DungeonEditorControlsPanelModel",
            "features.dungeon.adapter.javafx.editor.DungeonEditorControlsView",
            "features.dungeon.adapter.javafx.editor.DungeonEditorFeatureShellBinding",
            "features.dungeon.adapter.javafx.editor.DungeonEditorViewModel",
            "features.dungeon.adapter.javafx.map.DungeonMapContentModel",
            "features.dungeon.adapter.javafx.map.DungeonMapEditorHandleProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapEditorProjectionAccumulator",
            "features.dungeon.adapter.javafx.map.DungeonMapEditorRenderProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapFrameConsumption",
            "features.dungeon.adapter.javafx.map.DungeonMapFrameProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapHitAreaIndex",
            "features.dungeon.adapter.javafx.map.DungeonMapHitIndex",
            "features.dungeon.adapter.javafx.map.DungeonMapPreparedPreviewProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapPreviewAreaDiffProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapPreviewBoundaryDiffProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapPreviewDiffProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapPreviewFeatureDiffProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapPreviewHandleDiffProjector",
            "features.dungeon.adapter.javafx.map.DungeonMapRenderElementFactory",
            "features.dungeon.adapter.javafx.map.DungeonMapRenderMarkers",
            "features.dungeon.adapter.javafx.map.DungeonMapRenderState",
            "features.dungeon.adapter.javafx.map.DungeonMapSceneGeometry",
            "features.dungeon.adapter.javafx.map.DungeonMapSceneIdentity",
            "features.dungeon.adapter.javafx.map.DungeonMapSceneStyles");

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
