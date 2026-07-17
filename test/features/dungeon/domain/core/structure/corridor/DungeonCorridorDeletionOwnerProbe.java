package features.dungeon.domain.core.structure.corridor;

import java.util.List;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapAuthoring.AuthoredContent;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.RoomCluster;

public final class DungeonCorridorDeletionOwnerProbe {
    private static final long CORRIDOR_ID = 20L;
    private static final CorridorMapAuthoring CORRIDOR_AUTHORING = new CorridorMapAuthoring();

    private DungeonCorridorDeletionOwnerProbe() {
    }

    public static void assertInvalidReplacementRouteRejectedBeforeMutation() {
        DungeonMap base = DungeonMapAuthoring.empty(
                new DungeonMapIdentity(80L),
                "Corridor Replacement Route Rejection");
        base = base.paintRoomRectangle(new Cell(1, 0, 0), new Cell(1, 0, 0));
        RoomCluster blocker = base.topology().roomClusters().getFirst();
        Corridor corridor = replacementRouteFixture(blocker);
        DungeonMap withCorridor = DungeonMapAuthoring.authored(
                base.metadata().mapId(),
                base.metadata().mapName(),
                new AuthoredContent(
                        base.topology(),
                        base.topologyIndex(),
                        base.rooms(),
                        List.of(corridor),
                        base.stairs(),
                        base.transitionCatalog().transitions(),
                        base.featureMarkers()),
                base.revision());

        DungeonMap rejected = CORRIDOR_AUTHORING.deleteCorridor(
                withCorridor,
                CorridorDeletionTarget.corridorWaypoint(CORRIDOR_ID, 0));

        assertEquals(withCorridor, rejected,
                "corridor deletion owner rejects invalid replacement route before mutation");
    }

    private static Corridor replacementRouteFixture(RoomCluster blocker) {
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
                new CorridorBindings(
                        List.of(new CorridorWaypoint(blocker.clusterId(), relativeWaypoint, 0)),
                        List.of(),
                        List.of(
                                new CorridorAnchor(
                                        1L,
                                        CORRIDOR_ID,
                                        new Cell(0, 0, 0)),
                                new CorridorAnchor(
                                        2L,
                                        CORRIDOR_ID,
                                        new Cell(2, 0, 0))),
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
