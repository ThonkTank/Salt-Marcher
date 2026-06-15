package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public final class DungeonEditorToolBehaviorHarness {

    private DungeonEditorToolBehaviorHarness() {
    }

    public static void main(String[] args) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runPublishedHarness(
                "Dungeon Editor behavior harness",
                results -> DungeonEditorBehaviorSuiteHarness.run(List.of("all"), results));
    }
}
