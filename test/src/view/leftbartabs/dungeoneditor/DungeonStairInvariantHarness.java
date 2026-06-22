package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring.AuthoredContent;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoomSet;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.stair.StairGeometryDerivation;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.stair.StairShape;

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
        assertStairGeometryDerivation();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STAIR-005",
                "StairGeometryDerivation maps exact two-point editor endpoints to supported StairGeometrySpec values"
                        + " and rejects zero-span, out-of-bounds, and mismatched endpoints");
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
                new AuthoredContent(
                        base.topology(),
                        base.topologyIndex(),
                        base.rooms(),
                        List.of(corridor),
                        new StairCollection(List.of(boundStair)),
                        base.transitionCatalog().transitions(),
                        base.featureMarkers()),
                base.revision());
    }

    private static void assertStairGeometryDerivation() {
        StairGeometryDerivation derivation = new StairGeometryDerivation();
        assertSpec(
                derivation.derive(new Cell(2, 2, 0), new Cell(2, 2, 3), StairShape.STRAIGHT),
                StairShape.STRAIGHT,
                new Cell(2, 2, 0),
                Direction.NORTH,
                1,
                3,
                "straight same-column vertical span");
        assertSpec(
                derivation.derive(new Cell(2, 2, 0), new Cell(5, 2, 2), StairShape.STRAIGHT),
                StairShape.STRAIGHT,
                new Cell(2, 2, 0),
                Direction.EAST,
                4,
                2,
                "straight cardinal horizontal plus level span");
        assertSpec(
                derivation.derive(new Cell(9, 6, 0), new Cell(10, 5, 1), StairShape.SQUARE),
                StairShape.SQUARE,
                new Cell(9, 6, 0),
                Direction.NORTH,
                3,
                1,
                "square exact endpoint match");
        assertSpec(
                derivation.derive(new Cell(12, 6, 0), new Cell(13, 6, 1), StairShape.CIRCULAR),
                StairShape.CIRCULAR,
                new Cell(12, 6, 0),
                Direction.NORTH,
                3,
                1,
                "circular exact endpoint match");
        assertRejected(
                derivation.derive(new Cell(9, 6, 0), new Cell(12, 6, 1), StairShape.SQUARE),
                StairGeometryDerivation.Rejection.ENDPOINT_MISMATCH,
                "square endpoint mismatch");
        assertRejected(
                derivation.derive(new Cell(12, 6, 0), new Cell(40, 40, 1), StairShape.CIRCULAR),
                StairGeometryDerivation.Rejection.ENDPOINT_MISMATCH,
                "circular endpoint mismatch");
        assertRejected(
                derivation.derive(new Cell(1, 1, 0), new Cell(1, 1, 0), StairShape.STRAIGHT),
                StairGeometryDerivation.Rejection.ZERO_LEVEL_SPAN,
                "zero-span rejection");
        assertRejected(
                derivation.derive(new Cell(1, 1, 0), new Cell(1, 1, 13), StairShape.STRAIGHT),
                StairGeometryDerivation.Rejection.DIMENSION_OUT_OF_BOUNDS,
                "dimension bounds rejection");
    }

    private static void assertSpec(
            StairGeometryDerivation.Result result,
            StairShape shape,
            Cell anchor,
            Direction direction,
            int dimension1,
            int dimension2,
            String message
    ) {
        assertTrue(result.valid(), message + " derives a valid spec");
        StairGeometrySpec spec = result.spec();
        assertEquals(shape, spec.shape(), message + " shape");
        assertEquals(anchor, spec.anchor(), message + " anchor");
        assertEquals(direction, spec.direction(), message + " direction");
        assertEquals(dimension1, spec.dimension1(), message + " dimension1");
        assertEquals(dimension2, spec.dimension2(), message + " dimension2");
    }

    private static void assertRejected(
            StairGeometryDerivation.Result result,
            StairGeometryDerivation.Rejection rejection,
            String message
    ) {
        assertFalse(result.valid(), message + " rejects");
        assertEquals(rejection, result.rejection(), message + " rejection");
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
