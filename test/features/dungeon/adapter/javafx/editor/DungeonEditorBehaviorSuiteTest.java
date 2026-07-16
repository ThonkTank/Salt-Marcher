package features.dungeon.adapter.javafx.editor;

import org.junit.jupiter.api.Test;

@org.junit.jupiter.api.Tag("ui")
public final class DungeonEditorBehaviorSuiteTest {

    @Test
    void geometryInvariants() throws Exception {
        run(DungeonGeometryInvariantScenarios::run);
    }

    @Test
    void componentInvariants() throws Exception {
        run(DungeonComponentInvariantScenarios::run);
    }

    @Test
    void floorInvariants() throws Exception {
        run(DungeonFloorInvariantScenarios::run);
    }

    @Test
    void wallInvariants() throws Exception {
        run(DungeonWallInvariantScenarios::run);
    }

    @Test
    void doorInvariants() throws Exception {
        run(DungeonDoorInvariantScenarios::run);
    }

    @Test
    void pathInvariants() throws Exception {
        run(DungeonPathInvariantScenarios::run);
    }

    @Test
    void corridorInvariants() throws Exception {
        run(DungeonCorridorInvariantScenarios::run);
    }

    @Test
    void stairInvariants() throws Exception {
        run(DungeonStairInvariantScenarios::run);
    }

    @Test
    void transitionInvariants() throws Exception {
        run(DungeonTransitionInvariantScenarios::run);
    }

    @Test
    void runtimeProjectionInvariants() throws Exception {
        run(DungeonRuntimeProjectionInvariantScenarios::run);
    }

    @Test
    void topologyInvariants() throws Exception {
        run(DungeonTopologyInvariantScenarios::run);
    }

    @Test
    void clusterInvariants() throws Exception {
        run(DungeonClusterInvariantScenarios::run);
    }

    @Test
    void roomInvariants() throws Exception {
        run(DungeonRoomInvariantScenarios::run);
    }

    @Test
    void structureInvariants() throws Exception {
        run(DungeonStructureInvariantScenarios::run);
    }

    @Test
    void mapCatalogBehavior() throws Exception {
        run(DungeonEditorMapCatalogScenarios::run);
    }

    @Test
    void mapControlsBehavior() throws Exception {
        run(DungeonEditorMapControlsScenarios::run);
    }

    @Test
    void projectionOverlayBehavior() throws Exception {
        run(DungeonEditorProjectionOverlayScenarios::run);
    }

    @Test
    void selectionBehavior() throws Exception {
        run(DungeonEditorSelectionScenarios::run);
    }

    @Test
    void stairBehavior() throws Exception {
        run(DungeonEditorStairScenarios::run);
    }

    @Test
    void transitionBehavior() throws Exception {
        run(DungeonEditorTransitionScenarios::run);
    }

    @Test
    void featureMarkerBehavior() throws Exception {
        run(DungeonEditorFeatureMarkerScenarios::run);
    }

    @Test
    void corridorBehavior() throws Exception {
        run(DungeonEditorCorridorScenarios::run);
    }

    @Test
    void labelBehavior() throws Exception {
        run(DungeonEditorClusterLabelHandleScenarios::runLabels);
    }

    @Test
    void sharedHandleBehavior() throws Exception {
        run(DungeonEditorClusterLabelHandleScenarios::runSharedHandles);
    }

    @Test
    void doorHandleBehavior() throws Exception {
        run(DungeonEditorClusterLabelHandleScenarios::runDoorHandles);
    }

    @Test
    void clusterHandleBehavior() throws Exception {
        run(DungeonEditorClusterLabelHandleScenarios::runClusterHandles);
    }

    @Test
    void clusterRouteBehavior() throws Exception {
        run(DungeonEditorRoomWallDoorScenarios::runClusterMovement);
    }

    @Test
    void doorBehavior() throws Exception {
        run(DungeonEditorRoomWallDoorScenarios::runDoor);
    }

    @Test
    void roomBehavior() throws Exception {
        run(DungeonEditorRoomWallDoorScenarios::runRoom);
    }

    @Test
    void wallBehavior() throws Exception {
        run(DungeonEditorRoomWallDoorScenarios::runWall);
    }

    private static void run(Scenario scenario) throws Exception {
        scenario.run();
    }

    @FunctionalInterface
    private interface Scenario {
        void run() throws Exception;
    }
}
