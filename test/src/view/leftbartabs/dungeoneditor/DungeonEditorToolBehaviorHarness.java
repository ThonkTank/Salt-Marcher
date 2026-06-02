package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;

public final class DungeonEditorToolBehaviorHarness {

    private DungeonEditorToolBehaviorHarness() {
    }

    public static void main(String[] args) throws Exception {
        try (DungeonEditorBehaviorHarnessSupport.ResultPublicationLock ignored =
                     DungeonEditorBehaviorHarnessSupport.lockResults()) {
            try {
                DungeonEditorBehaviorHarnessSupport.clearResults();
                List<String> results = new ArrayList<>();
                DungeonEditorMapCatalogHarness.run(results);
                DungeonEditorMapControlsHarness.run(results);
                DungeonEditorProjectionOverlayHarness.run(results);
                DungeonEditorSelectionHarness.run(results);
                DungeonGeometryInvariantHarness.run(results);
                DungeonComponentInvariantHarness.run(results);
                DungeonStructureInvariantHarness.run(results);
                DungeonEditorStairHarness.run(results);
                DungeonEditorTransitionHarness.run(results);
                DungeonEditorCorridorHarness.run(results);
                DungeonEditorRoomWallDoorHarness.run(results);
                DungeonEditorBehaviorHarnessSupport.writeResults(results);
                System.out.println("Dungeon Editor behavior harness passed: " + results.size() + " proof item(s).");
                for (String result : results) {
                    System.out.println(result);
                }
                DungeonEditorBehaviorHarnessSupport.shutdownFx();
                System.exit(0);
            } catch (Throwable throwable) {
                DungeonEditorBehaviorHarnessSupport.clearResults();
                throwable.printStackTrace(System.err);
                System.exit(1);
            }
        }
    }
}
