package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public final class DungeonEditorRouteBehaviorHarness {

    private DungeonEditorRouteBehaviorHarness() {
    }

    public static void main(String[] args) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runPublishedHarness(
                "Dungeon Editor route behavior harness",
                results -> DungeonEditorBehaviorSuiteHarness.run(List.of("routes"), results));
    }

    static void run(List<String> results) throws Exception {
        DungeonEditorBehaviorSuiteHarness.run(List.of("routes"), results);
    }
}
