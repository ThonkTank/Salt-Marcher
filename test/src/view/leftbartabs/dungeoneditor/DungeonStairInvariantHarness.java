package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoomSet;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

final class DungeonStairInvariantHarness {

    private static final String OWNER = "StairInvariantHarness";
    private static final long CORRIDOR_ID = 20L;
    private static final long STAIR_ID = 9L;

    private DungeonStairInvariantHarness() {
    }

    static void run(List<String> results) {
        assertCorridorBoundDeleteOwnership();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STAIR-004",
                "StairCollection and DungeonMap reject direct corridor-bound stair delete while"
                        + " owning corridor deletion removes the corridor-bound stair through the corridor owner path");
    }

    private static void assertCorridorBoundDeleteOwnership() {
        DungeonMap map = corridorBoundStairMap();

        assertFalse(map.stairs().canDeleteUnboundStair(STAIR_ID),
                "stair binding owner rejects direct delete eligibility for corridor-bound stair");
        assertEquals(map.stairs(), map.stairs().withoutUnboundStair(STAIR_ID),
                "stair binding owner keeps corridor-bound stair on direct delete request");
        assertFalse(map.canDeleteStair(STAIR_ID),
                "DungeonMap aggregate rejects direct corridor-bound stair delete");
        assertEquals(map, map.deleteStair(STAIR_ID),
                "DungeonMap direct delete leaves corridor-bound stair map unchanged");

        DungeonMap corridorDeleted = map.deleteCorridor(CORRIDOR_ID, "CORRIDOR", 0L, 0L, 0);
        assertTrue(corridorDeleted.corridors().isEmpty(),
                "corridor owner removes the owning corridor");
        assertTrue(corridorDeleted.stairs().stairs().isEmpty(),
                "corridor owner removes corridor-bound stairs when the owning corridor is deleted");
    }

    private static DungeonMap corridorBoundStairMap() {
        DungeonMap base = DungeonMapAuthoring.empty(
                new DungeonMapIdentity(90L),
                "Corridor Bound Stair Invariant");
        Corridor corridor = new Corridor(
                CORRIDOR_ID,
                90L,
                0,
                new CorridorRoomSet(List.of()),
                CorridorBindingState.empty());
        Stair boundStair = Stair.corridorBound(
                STAIR_ID,
                90L,
                CORRIDOR_ID,
                List.of(new Cell(0, 0, 0), new Cell(0, 1, 0)),
                new Cell(0, 1, 1));
        return DungeonMapAuthoring.authored(
                base.metadata().mapId(),
                base.metadata().mapName(),
                base.topology(),
                base.topologyIndex(),
                base.rooms(),
                List.of(corridor),
                new StairCollection(List.of(boundStair)),
                base.transitionCatalog().transitions(),
                base.revision());
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
