package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization;
import features.dungeon.domain.core.structure.room.RoomClusterFloorMap;
import features.dungeon.domain.core.structure.room.RoomClusterWallMap;
import features.dungeon.domain.core.structure.room.RoomClusterWallRun;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;

final class DungeonClusterInvariantScenarios {


    private DungeonClusterInvariantScenarios() {
    }

    static void run() {
        assertClusterIdentitySurvivesMutations();

        assertTrueCornerFacts();

        assertWallRunDerivation();

        assertWallRunMutationAcceptReject();

        assertExactWallRunStretchPreservesJunctionConnectors();

        assertClusterDefaultAndCustomNames();

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
                0,
                roomIds(100L, 100L));
        assertEquals(clusterId, firstClusterId(stretched), "DGI-CLUSTER-001 wall-run stretch keeps cluster id");
        DungeonMap cornerMoved = map.moveClusterCorner(
                clusterId,
                new Cell(1, 1, 0),
                -1,
                -1,
                0,
                roomIds(200L, 200L));
        assertEquals(clusterId, firstClusterId(cornerMoved), "DGI-CLUSTER-001 corner movement keeps cluster id");
    }

    private static void assertTrueCornerFacts() {
        RoomCluster cluster = nonRectangularCluster();
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
        List<RoomClusterWallRun> runs = wallMap.authoredWallRuns(0);
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
        DungeonMap accepted = map.moveBoundaryStretch(
                clusterId, topRun, 0, -1, 0, roomIds(300L, 300L));
        assertTrue(!accepted.equals(map), "DGI-CLUSTER-004 valid wall-run movement changes map");
        DungeonMap rejected = map.moveBoundaryStretch(
                clusterId, topRun, 0, 12, 0, roomIds(400L, 400L));
        assertEquals(map, rejected, "DGI-CLUSTER-004 invalid wall-run movement leaves map unchanged");
    }

    private static void assertExactWallRunStretchPreservesJunctionConnectors() {
        assertTConnectorStretch();
        assertXConnectorStretch();
    }

    private static void assertTConnectorStretch() {
        DungeonMap map = interiorJunctionMap(List.of(
                edge(3, 1, 3, 2),
                edge(3, 2, 3, 3),
                edge(3, 3, 3, 4),
                edge(3, 4, 3, 5),
                edge(3, 3, 4, 3),
                edge(4, 3, 5, 3)));
        long clusterId = firstClusterId(map);

        DungeonMap moved = map.moveBoundaryStretch(
                clusterId,
                List.of(edge(3, 1, 3, 2), edge(3, 2, 3, 3)),
                -1,
                0,
                0,
                roomIds(500L, 500L));

        assertTrue(hasBoundary(moved, edge(2, 1, 2, 2)), "DGI-CLUSTER-006 T moved upper segment 1");
        assertTrue(hasBoundary(moved, edge(2, 2, 2, 3)), "DGI-CLUSTER-006 T moved upper segment 2");
        assertTrue(!hasBoundary(moved, edge(2, 3, 2, 4)), "DGI-CLUSTER-006 T does not move lower same-line run");
        assertTrue(hasBoundary(moved, edge(3, 3, 3, 4)), "DGI-CLUSTER-006 T keeps lower split run in place");
        assertTrue(hasBoundary(moved, edge(2, 3, 3, 3)), "DGI-CLUSTER-006 T stretches horizontal connector to moved run");
        assertTrue(hasBoundary(moved, edge(3, 3, 4, 3)), "DGI-CLUSTER-006 T keeps original horizontal branch");
    }

    private static void assertXConnectorStretch() {
        DungeonMap map = interiorJunctionMap(List.of(
                edge(3, 1, 3, 2),
                edge(3, 2, 3, 3),
                edge(3, 3, 3, 4),
                edge(3, 4, 3, 5),
                edge(1, 3, 2, 3),
                edge(2, 3, 3, 3),
                edge(3, 3, 4, 3),
                edge(4, 3, 5, 3)));
        long clusterId = firstClusterId(map);

        DungeonMap moved = map.moveBoundaryStretch(
                clusterId,
                List.of(edge(3, 1, 3, 2), edge(3, 2, 3, 3)),
                -1,
                0,
                0,
                roomIds(600L, 600L));

        assertTrue(hasBoundary(moved, edge(2, 1, 2, 2)), "DGI-CLUSTER-006 X moved upper segment 1");
        assertTrue(hasBoundary(moved, edge(2, 2, 2, 3)), "DGI-CLUSTER-006 X moved upper segment 2");
        assertTrue(hasBoundary(moved, edge(2, 3, 3, 3)), "DGI-CLUSTER-006 X keeps west branch connected");
        assertTrue(hasBoundary(moved, edge(3, 3, 4, 3)), "DGI-CLUSTER-006 X keeps east branch connected");
        assertTrue(hasBoundary(moved, edge(3, 3, 3, 4)), "DGI-CLUSTER-006 X keeps lower split run in place");
        assertTrue(!hasBoundary(moved, edge(2, 3, 2, 4)), "DGI-CLUSTER-006 X does not move lower same-line run");
    }

    private static DungeonMap interiorJunctionMap(List<Edge> walls) {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(10L), "Cluster Junction Test")
                .paintRoomRectangle(
                        new Cell(1, 1, 0), new Cell(5, 5, 0), roomIds(10L, 10L));
        return map.editClusterBoundaries(
                firstClusterId(map),
                walls,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL,
                false,
                roomIds(700L, 700L));
    }

    private static Edge edge(int fromQ, int fromR, int toQ, int toR) {
        return new Edge(new Cell(fromQ, fromR, 0), new Cell(toQ, toR, 0));
    }

    private static boolean hasBoundary(DungeonMap map, Edge edge) {
        return map.topology().roomClusters().getFirst().boundaryAt(edge) != null;
    }

    private static void assertClusterDefaultAndCustomNames() {
        RoomCluster defaultCluster = RoomCluster.authored(
                42L,
                7L,
                "",
                new Cell(0, 0, 0),
                Map.of());
        assertEquals("Cluster 42", defaultCluster.name(), "DGI-CLUSTER-005 default cluster name");
        assertEquals("North Hall", defaultCluster.withName("  North Hall  ").name(),
                "DGI-CLUSTER-005 custom cluster name trims");

    }

    private static DungeonMap twoByTwoMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(9L), "Cluster Test")
                .paintRoomRectangle(
                        new Cell(1, 1, 0), new Cell(2, 2, 0), roomIds(20L, 20L));
    }

    private static RoomTopologyWorkCatalog.ReservedIdentities roomIds(
            long firstClusterId,
            long firstRoomId
    ) {
        return new RoomTopologyWorkCatalog.ReservedIdentities(
                firstClusterId, 64, firstRoomId, 64);
    }

    private static RoomCluster nonRectangularCluster() {
        return RoomCluster.authored(
                15L,
                9L,
                "",
                new Cell(10, 10, 0),
                Map.of(0, List.of(
                        boundary(0, 0, Direction.NORTH),
                        boundary(1, 0, Direction.NORTH),
                        boundary(2, 0, Direction.NORTH),
                        boundary(2, 0, Direction.EAST),
                        boundary(1, 0, Direction.SOUTH),
                        boundary(2, 0, Direction.SOUTH),
                        boundary(0, 1, Direction.EAST),
                        boundary(0, 2, Direction.EAST),
                        boundary(0, 2, Direction.SOUTH),
                        boundary(0, 2, Direction.WEST),
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
        DungeonEditorTestSupport.assertEquals(expected, actual, message);
    }

    private static void assertTrue(boolean condition, String message) {
        DungeonEditorTestSupport.assertTrue(condition, message);
    }
}
