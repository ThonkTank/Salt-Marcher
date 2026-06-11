package src.domain.dungeon.model.core.structure.corridor;

import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

public final class DungeonCorridorDeletionOwnerProbe {
    private static final long CORRIDOR_ID = 20L;

    private DungeonCorridorDeletionOwnerProbe() {
    }

    public static void assertInvalidReplacementRouteRejectedBeforeMutation() {
        DungeonMap base = DungeonMapAuthoring.empty(
                new DungeonMapIdentity(80L),
                "Corridor Replacement Route Rejection");
        base = base.paintRoomRectangle(new Cell(1, 0, 0), new Cell(1, 0, 0));
        DungeonRoomCluster blocker = base.topology().roomClusters().getFirst();
        Corridor corridor = replacementRouteFixture(blocker);
        DungeonMap withCorridor = DungeonMapAuthoring.authored(
                base.metadata().mapId(),
                base.metadata().mapName(),
                base.topology(),
                base.topologyIndex(),
                base.rooms(),
                List.of(corridor),
                base.stairs(),
                base.transitionCatalog().transitions(),
                base.revision());

        DungeonMap rejected = withCorridor.deleteCorridor(
                CORRIDOR_ID,
                "CORRIDOR_WAYPOINT",
                0L,
                0L,
                0);

        assertEquals(withCorridor, rejected,
                "corridor deletion owner rejects invalid replacement route before mutation");
    }

    private static Corridor replacementRouteFixture(DungeonRoomCluster blocker) {
        Cell waypoint = new Cell(0, 1, 0);
        Cell relativeWaypoint = new Cell(
                waypoint.q() - blocker.center().q(),
                waypoint.r() - blocker.center().r(),
                waypoint.level());
        return new Corridor(
                CORRIDOR_ID,
                80L,
                0,
                new CorridorRoomSet(List.of()),
                new CorridorBindingState(
                        List.of(new CorridorWaypoint(blocker.clusterId(), relativeWaypoint, 0)),
                        List.of(),
                        List.of(
                                new CorridorAnchorBinding(
                                        1L,
                                        CORRIDOR_ID,
                                        new Cell(0, 0, 0),
                                        DungeonTopologyRef.corridorAnchor(1L)),
                                new CorridorAnchorBinding(
                                        2L,
                                        CORRIDOR_ID,
                                        new Cell(2, 0, 0),
                                        DungeonTopologyRef.corridorAnchor(2L))),
                        List.of(
                                new CorridorAnchorRef(CORRIDOR_ID, 1L),
                                new CorridorAnchorRef(CORRIDOR_ID, 2L))));
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new IllegalStateException(message + " expected=" + expected + " actual=" + actual);
        }
    }
}
