package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public final class DungeonEditorRouteBehaviorHarness {

    private DungeonEditorRouteBehaviorHarness() {
    }

    public static void main(String[] args) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runPublishedHarness(
                "Dungeon Editor route behavior harness",
                DungeonEditorRouteBehaviorHarness::run);
    }

    static void run(List<String> results) throws Exception {
        runStartupRouteSuites(results);
        runMapMutationRouteSuites(results);
    }

    static void runStartupRouteSuites(List<String> results) throws Exception {
        DungeonEditorMapCatalogHarness.run(results);
        DungeonEditorMapControlsHarness.run(results);
        DungeonEditorProjectionOverlayHarness.run(results);
        DungeonEditorSelectionHarness.run(results);
    }

    static void runMapMutationRouteSuites(List<String> results) throws Exception {
        DungeonEditorStairHarness.run(results);
        DungeonEditorTransitionHarness.run(results);
        DungeonEditorCorridorHarness.run(results);
        DungeonEditorClusterLabelHandleHarness.run(results);
        DungeonEditorRoomWallDoorHarness.run(results);
    }
}
