package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public final class DungeonCoreModelInvariantHarness {

    private DungeonCoreModelInvariantHarness() {
    }

    public static void main(String[] args) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runPublishedHarness(
                "Dungeon Core model invariant harness",
                DungeonCoreModelInvariantHarness::run);
    }

    static void run(List<String> results) {
        DungeonGeometryInvariantHarness.run(results);
        DungeonComponentInvariantHarness.run(results);
        DungeonFloorInvariantHarness.run(results);
        DungeonWallInvariantHarness.run(results);
        DungeonDoorInvariantHarness.run(results);
        DungeonPathInvariantHarness.run(results);
        DungeonCorridorInvariantHarness.run(results);
        DungeonStairInvariantHarness.run(results);
        DungeonTransitionInvariantHarness.run(results);
        DungeonRuntimeProjectionInvariantHarness.run(results);
        DungeonTopologyInvariantHarness.run(results);
        DungeonClusterInvariantHarness.run(results);
        DungeonRoomInvariantHarness.run(results);
        DungeonStructureInvariantHarness.run(results);
    }
}
