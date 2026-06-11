package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap;

final class DungeonClusterInvariantHarness {

    private static final String OWNER = "ClusterInvariantHarness";

    private DungeonClusterInvariantHarness() {
    }

    static void run(List<String> results) {
        assertClusterIdentitySurvivesMutations();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CLUSTER-001",
                "DungeonMap cluster move, wall-run stretch, and corner movement preserve cluster identity");
        assertTrueCornerFacts();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CLUSTER-002",
                "DungeonRoomCluster authored boundary vertices expose true corners instead of bounding-box corners");
        assertWallRunDerivation();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CLUSTER-003",
                "RoomClusterWallMap derives wall-line handles from contiguous straight wall runs");
        assertWallRunMutationAcceptReject();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CLUSTER-004",
                "DungeonMap boundary-stretch mutation accepts valid wall-run movement and rejects invalid movement atomically");
        assertClusterDefaultAndCustomNames();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CLUSTER-005",
                "DungeonRoomCluster and DungeonMap keep default Cluster <clusterId> and authored custom cluster names");
    }

    private static void assertClusterIdentitySurvivesMutations() {
        DungeonMap map = twoByTwoMap();
        long clusterId = firstClusterId(map);
        DungeonMap moved = map.moveCluster(clusterId, 2, 0, 0);
        assertEquals(clusterId, firstClusterId(moved), "DGI-CLUSTER-001 move keeps cluster id");
        DungeonMap stretched = map.moveBoundaryStretch(
                clusterId,
                List.of(Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH), Edge.sideOf(new Cell(2, 1, 0), Direction.NORTH)),
                0,
                -1,
                0);
        assertEquals(clusterId, firstClusterId(stretched), "DGI-CLUSTER-001 wall-run stretch keeps cluster id");
        DungeonMap cornerMoved = map.moveClusterCorner(clusterId, new Cell(1, 1, 0), -1, -1, 0);
        assertEquals(clusterId, firstClusterId(cornerMoved), "DGI-CLUSTER-001 corner movement keeps cluster id");
    }

    private static void assertTrueCornerFacts() {
        DungeonRoomCluster cluster = nonRectangularCluster();
        List<Cell> vertices = cluster.authoredBoundaryVertices(0);
        assertTrue(vertices.contains(new Cell(13, 11, 0)), "DGI-CLUSTER-002 includes true inset corner");
        assertTrue(!vertices.contains(new Cell(13, 13, 0)), "DGI-CLUSTER-002 omits missing bounding-box corner");
    }

    private static void assertWallRunDerivation() {
        RoomClusterWallMap wallMap = new RoomClusterWallMap(new Cell(0, 0, 0), List.of(
                new RoomClusterBoundaryMaterialization.BoundaryRow(
                        42L,
                        0,
                        new Cell(0, 0, 0),
                        Direction.NORTH,
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL),
                new RoomClusterBoundaryMaterialization.BoundaryRow(
                        42L,
                        0,
                        new Cell(1, 0, 0),
                        Direction.NORTH,
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL)));
        List<RoomClusterWallMap.WallRun> runs = wallMap.authoredWallRuns(0);
        assertEquals(1, runs.size(), "DGI-CLUSTER-003 derives one contiguous two-segment wall run");
        assertEquals(Direction.NORTH, runs.getFirst().direction(),
                "DGI-CLUSTER-003 preserves wall-run direction");
        assertTrue(Double.isFinite(runs.getFirst().markerQ()) && Double.isFinite(runs.getFirst().markerR()),
                "DGI-CLUSTER-003 derives finite wall-run midpoint facts");
    }

    private static void assertWallRunMutationAcceptReject() {
        DungeonMap map = twoByTwoMap();
        long clusterId = firstClusterId(map);
        List<Edge> topRun = List.of(
                Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH),
                Edge.sideOf(new Cell(2, 1, 0), Direction.NORTH));
        DungeonMap accepted = map.moveBoundaryStretch(clusterId, topRun, 0, -1, 0);
        assertTrue(!accepted.equals(map), "DGI-CLUSTER-004 valid wall-run movement changes map");
        DungeonMap rejected = map.moveBoundaryStretch(clusterId, topRun, 0, 12, 0);
        assertEquals(map, rejected, "DGI-CLUSTER-004 invalid wall-run movement leaves map unchanged");
    }

    private static void assertClusterDefaultAndCustomNames() {
        DungeonRoomCluster defaultCluster = new DungeonRoomCluster(42L, 7L, "", new Cell(0, 0, 0), Map.of(), Map.of());
        assertEquals("Cluster 42", defaultCluster.name(), "DGI-CLUSTER-005 default cluster name");
        assertEquals("North Hall", defaultCluster.withName("  North Hall  ").name(),
                "DGI-CLUSTER-005 custom cluster name trims");

        DungeonMap map = twoByTwoMap();
        long clusterId = firstClusterId(map);
        DungeonMap renamed = map.saveClusterName(clusterId, "  Gallery Cluster  ");
        assertEquals("Gallery Cluster", firstClusterName(renamed), "DGI-CLUSTER-005 aggregate saves cluster name");
    }

    private static DungeonMap twoByTwoMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(9L), "Cluster Harness")
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(2, 2, 0));
    }

    private static DungeonRoomCluster nonRectangularCluster() {
        return new DungeonRoomCluster(
                15L,
                9L,
                "",
                new Cell(10, 10, 0),
                Map.of(0, List.of(
                        new Cell(0, 0, 0),
                        new Cell(3, 0, 0),
                        new Cell(3, 1, 0),
                        new Cell(1, 1, 0),
                        new Cell(1, 3, 0),
                        new Cell(0, 3, 0))),
                Map.of(0, List.of(
                        boundary(0, 0, Direction.NORTH),
                        boundary(1, 0, Direction.NORTH),
                        boundary(2, 0, Direction.NORTH),
                        boundary(3, 0, Direction.EAST),
                        boundary(2, 1, Direction.SOUTH),
                        boundary(1, 1, Direction.EAST),
                        boundary(1, 2, Direction.EAST),
                        boundary(0, 2, Direction.SOUTH),
                        boundary(0, 1, Direction.WEST),
                        boundary(0, 0, Direction.WEST))));
    }

    private static DungeonClusterBoundary boundary(
            int q,
            int r,
            Direction direction
    ) {
        return new DungeonClusterBoundary(
                15L,
                0,
                new Cell(q, r, 0),
                direction,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);
    }

    private static long firstClusterId(DungeonMap map) {
        return map.topology().roomClusters().getFirst().clusterId();
    }

    private static String firstClusterName(DungeonMap map) {
        return map.topology().roomClusters().getFirst().name();
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        DungeonEditorBehaviorHarnessSupport.assertEquals(expected, actual, message);
    }

    private static void assertTrue(boolean condition, String message) {
        DungeonEditorBehaviorHarnessSupport.assertTrue(condition, message);
    }
}
