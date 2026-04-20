package src.domain.dungeon.application;

import src.domain.dungeon.map.DungeonCorridorAggregate;
import src.domain.dungeon.map.DungeonDerivedState;
import src.domain.dungeon.map.DungeonDocument;
import src.domain.dungeon.map.DungeonDoorPrimitive;
import src.domain.dungeon.map.DungeonPrimitive;
import src.domain.dungeon.map.DungeonRelationGraph;
import src.domain.dungeon.map.DungeonRoomAggregate;
import src.domain.dungeon.map.DungeonWallPrimitive;
import src.domain.dungeon.map.DungeonCell;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonMapSnapshot;

import java.util.ArrayList;
import java.util.List;

/**
 * Rebuilds render and lookup state from committed dungeon truth.
 */
public final class BuildDungeonDerivedStateUseCase {

    private static final String DOOR_KIND = "door";

    public DungeonDerivedState execute(DungeonDocument document) {
        List<DungeonCell> roomCells = buildRoomCells(document);
        List<DungeonCell> corridorCells = buildCorridorCells(document);
        DungeonRoomAggregate room = new DungeonRoomAggregate(1L, "Entry Hall", roomCells);
        DungeonCorridorAggregate corridor = new DungeonCorridorAggregate(2L, "South Corridor", corridorCells);
        DungeonDoorPrimitive door = new DungeonDoorPrimitive(100L, "Oak Door", new DungeonEdgeRef(roomCells.get(3).toCellRef(), corridorCells.getFirst().toCellRef()));

        List<DungeonWallPrimitive> walls = List.of(
                new DungeonWallPrimitive(200L, new DungeonEdgeRef(roomCells.getFirst().toCellRef(), roomCells.get(1).toCellRef())),
                new DungeonWallPrimitive(201L, new DungeonEdgeRef(roomCells.get(2).toCellRef(), roomCells.get(3).toCellRef()))
        );

        DungeonRelationGraph relations = new DungeonRelationGraph(
                List.of(
                        new DungeonRelationGraph.ContainmentRelation(room.id(), door.id(), DOOR_KIND),
                        new DungeonRelationGraph.ContainmentRelation(corridor.id(), door.id(), DOOR_KIND)
                ),
                List.of(
                        new DungeonRelationGraph.ConnectionRelation(corridor.id(), room.id(), "south")
                )
        );

        DungeonMapSnapshot map = new DungeonMapSnapshot(
                document.topology(),
                document.width(),
                document.height(),
                List.of(
                        new DungeonAreaSnapshot(DungeonAreaKind.ROOM, room.id(), room.label(),
                                roomCells.stream().map(DungeonCell::toCellRef).toList()),
                        new DungeonAreaSnapshot(DungeonAreaKind.CORRIDOR, corridor.id(), corridor.label(),
                                corridorCells.stream().map(DungeonCell::toCellRef).toList())
                ),
                List.of(
                        new DungeonBoundarySnapshot(DOOR_KIND, door.id(), door.label(), door.edge()),
                        new DungeonBoundarySnapshot("wall", walls.getFirst().id(), "North Wall", walls.getFirst().edge()),
                        new DungeonBoundarySnapshot("wall", walls.get(1).id(), "South Wall", walls.get(1).edge())
                )
        );

        List<Object> primitives = new ArrayList<>();
        primitives.add(door);
        primitives.addAll(walls);
        return new DungeonDerivedState(map, List.of(room, corridor), primitives.stream()
                .map(DungeonPrimitive.class::cast)
                .toList(), relations);
    }

    private List<DungeonCell> buildRoomCells(DungeonDocument document) {
        List<DungeonCell> cells = new ArrayList<>();
        for (int r = 0; r < 2; r++) {
            for (int q = 0; q < 3; q++) {
                cells.add(new DungeonCell(document.roomAnchorQ() + q, document.roomAnchorR() + r, 0));
            }
        }
        return List.copyOf(cells);
    }

    private List<DungeonCell> buildCorridorCells(DungeonDocument document) {
        int startQ = document.roomAnchorQ() + 1;
        int startR = document.roomAnchorR() + 2;
        return List.of(
                new DungeonCell(startQ, startR, 0),
                new DungeonCell(startQ, startR + 1, 0),
                new DungeonCell(startQ, startR + 2, 0)
        );
    }
}
