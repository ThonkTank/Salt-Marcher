package src.view.leftbartabs.dungeoneditor;

public final class DungeonEditorToolBehaviorHarness {

    private DungeonEditorToolBehaviorHarness() {
    }

    public static void main(String[] args) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runPublishedHarness(
                "Dungeon Editor behavior harness",
                results -> {
                    DungeonEditorRouteBehaviorHarness.runStartupRouteSuites(results);
                    DungeonCoreModelInvariantHarness.run(results);
                    DungeonEditorRouteBehaviorHarness.runMapMutationRouteSuites(results);
                });
    }
}
