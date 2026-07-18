package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.Route;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.corridor.CorridorRoute;
import features.dungeon.domain.core.structure.corridor.CorridorRoutePlan;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan;
import features.dungeon.domain.core.structure.room.RoomClusterFloorMap;
import features.dungeon.domain.core.structure.room.RoomClusterWallMap;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.application.editor.DungeonEditorRuntimeDraftOwnerProbe;

final class DungeonPathInvariantScenarios {
    private static final CorridorRoutingPolicy ROUTING_POLICY = new OrthogonalCorridorRoutingPolicy();


    private DungeonPathInvariantScenarios() {
    }

    static void run() {
        assertSharedPathPrimitives();

        assertCorridorPathOwner();

        assertStairPathOwner();

        assertBoundaryPathOwner();

        assertWallDraftPathFacts();


    }

    private static void assertSharedPathPrimitives() {
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0),
                        new Cell(2, 1, 0), new Cell(2, 1, 2)),
                Route.horizontalFirst(new Cell(0, 0, 0), new Cell(2, 1, 2)),
                "shared path primitive produces horizontal-first path with final level transition");
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0),
                        new Cell(2, 1, 0)),
                Route.horizontalFirstOnStartLevel(new Cell(0, 0, 0), new Cell(2, 1, 2)),
                "shared path primitive can keep validation route on the start level");
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(0, 1, 0), new Cell(1, 1, 0),
                        new Cell(2, 1, 0)),
                Route.verticalFirstOnStartLevel(new Cell(0, 0, 0), new Cell(2, 1, 2)),
                "shared path primitive can derive vertical-first validation route on the start level");
        assertEquals(List.of(), Route.horizontalFirst(null, new Cell(1, 1, 0)),
                "shared path primitive treats missing endpoints as no path");
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0)),
                new CorridorRoute(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0))).cells(),
                "corridor path owner exposes defensive path copies");
    }

    private static void assertCorridorPathOwner() {
        CorridorRoute route = ROUTING_POLICY.route(new Cell(0, 0, 0), new Cell(2, 1, 1), Set.of());
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0),
                        new Cell(2, 1, 0)),
                route.cells(),
                "corridor path owner derives start-level route cells");
        assertTrue(route.present(), "corridor path owner reports present route");
        assertTrue(route.blockedBy(Set.of(new Cell(1, 0, 0))),
                "corridor path owner detects blocked route cells");
        assertFalse(route.blockedBy(Set.of(new Cell(8, 8, 0))),
                "corridor path owner keeps unrelated room cells from blocking route");
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(0, 1, 0), new Cell(1, 1, 0),
                        new Cell(2, 1, 0)),
                ROUTING_POLICY.route(
                                new Cell(0, 0, 0),
                                new Cell(2, 1, 1),
                                Set.of(new Cell(1, 0, 0)))
                        .cells(),
                "corridor path owner falls back to vertical-first when horizontal-first is blocked");
        assertFalse(ROUTING_POLICY.route(
                        new Cell(0, 0, 0),
                        new Cell(2, 1, 1),
                        Set.of(new Cell(1, 0, 0), new Cell(0, 1, 0)))
                .present(),
                "corridor path owner rejects when both orthogonal candidates are blocked");
        assertFalse(ROUTING_POLICY.route(null, new Cell(1, 0, 0), Set.of()).present(),
                "corridor path owner reports missing endpoint route as no-op");

        CorridorRoutePlan plan = new CorridorRoutePlan(
                route.cells(),
                10L,
                new Cell(0, 0, 0));
        CorridorAnchor higherHostAnchor = new CorridorAnchor(9L, 30L, new Cell(1, 0, 0));
        CorridorAnchor selectedAnchor = new CorridorAnchor(5L, 20L, new Cell(1, 0, 0));
        CorridorBindings planned = plan.bindInteriorAnchors(
                CorridorBindings.empty(),
                List.of(higherHostAnchor, selectedAnchor));
        assertEquals(List.of(new CorridorAnchorRef(20L, 5L)), planned.anchorRefs(),
                "corridor path owner selects deterministic interior route anchor");
        assertEquals(List.of(new CorridorWaypoint(10L, new Cell(1, 0, 0), 0)),
                planned.waypoints(),
                "corridor path owner creates relative interior waypoint");
        assertEquals(CorridorBindings.empty(),
                new CorridorRoutePlan(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0)), 10L, new Cell(0, 0, 0))
                        .bindInteriorAnchors(CorridorBindings.empty(), List.of(selectedAnchor)),
                "corridor path owner treats short split route as no-op");
    }

    private static void assertStairPathOwner() {
        StairGeometrySpec spec = new StairGeometrySpec(
                StairShape.STRAIGHT,
                new Cell(0, 0, 0),
                Direction.EAST,
                3,
                2);
        Stair stair = Stair.authored(8L, 2L, spec);

        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                spec.generatedPath(),
                "stair path owner generates straight path cells");
        assertEquals(List.of(
                        new StairExit(0L, new Cell(0, 0, 0), ""),
                        new StairExit(0L, new Cell(1, 0, 1), ""),
                        new StairExit(0L, new Cell(2, 0, 2), "")),
                stair.exits(),
                "stair path owner derives level exits from generated path");
        assertTrue(stair.isReadable(), "stair path owner reports readable generated path");
        assertEquals(Set.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0),
                        new Cell(1, 0, 1), new Cell(2, 0, 2)),
                stair.occupiedCells(),
                "stair path owner exposes path and exit occupancy");
        assertFalse(spec.avoidsRoomInteriors(Set.of(new Cell(1, 0, 0))),
                "stair path owner rejects generated path room-interior cells");
        assertTrue(spec.avoidsRoomInteriors(Set.of(new Cell(0, 0, 0))),
                "stair path owner allows generated exit room touch");
    }

    private static void assertBoundaryPathOwner() {
        Cell left = new Cell(0, 0, 0);
        Cell right = new Cell(1, 0, 0);
        RoomClusterFloorMap floorMap = RoomClusterFloorMap.fromCells(List.of(left, right));
        Cell center = new Cell(0, 0, 0);
        BoundaryRow leftRow = new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.NORTH, BoundaryKind.WALL);
        BoundaryRow rightRow = new BoundaryRow(42L, 0, new Cell(1, 0, 0), Direction.NORTH, BoundaryKind.WALL);
        RoomClusterWallMap wallMap = new RoomClusterWallMap(center, List.of(leftRow, rightRow));
        RoomClusterBoundaryStretchPlan.Selection selection = wallMap
                .stretchSelection(
                        floorMap,
                        List.of(Edge.sideOf(right, Direction.NORTH), Edge.sideOf(left, Direction.NORTH)),
                        0,
                        -1,
                        0)
                .orElseThrow(() -> new IllegalStateException("expected boundary path selection"));

        assertEquals(Set.of(new Cell(0, -1, 0), new Cell(1, -1, 0)), selection.stripCells(),
                "wall path owner derives moved strip cells from floor facts");
        assertEquals(List.of(new Edge(new Cell(0, 0, 0), new Cell(0, -1, 0))),
                selection.connectorPath(selection.vertices().getFirst()),
                "wall path owner derives connector path from wall selection");
    }

    private static void assertWallDraftPathFacts() {
        DungeonEditorRuntimeDraftOwnerProbe.assertWallDraftPathOwner();
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new IllegalStateException(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) {
            throw new IllegalStateException(message);
        }
    }

    private static void assertFalse(boolean value, String message) {
        if (value) {
            throw new IllegalStateException(message);
        }
    }
}
