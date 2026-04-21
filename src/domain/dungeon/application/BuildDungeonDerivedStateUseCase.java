package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.SpatialTopology;

import java.util.ArrayList;
import java.util.List;

/**
 * Rebuilds render and lookup state from committed dungeon truth.
 */
public final class BuildDungeonDerivedStateUseCase {

    private static final String DOOR_KIND = "door";

    public DungeonDerivedState execute(DungeonMap dungeonMap) {
        SpatialTopology topology = dungeonMap == null ? SpatialTopology.demo() : dungeonMap.topology();
        List<DungeonCell> roomCells = buildRoomCells(topology);
        List<DungeonCell> corridorCells = buildCorridorCells(topology);
        DungeonAggregate room = new DungeonAggregate(1L, DungeonAreaType.ROOM, "Entry Hall", roomCells);
        DungeonAggregate corridor = new DungeonAggregate(2L, DungeonAreaType.CORRIDOR, "South Corridor", corridorCells);
        DungeonPrimitive door = new DungeonPrimitive(
                100L,
                DOOR_KIND,
                "Oak Door",
                new DungeonEdge(roomCells.get(3), corridorCells.getFirst()));

        List<DungeonPrimitive> walls = List.of(
                new DungeonPrimitive(200L, "wall", "North Wall", new DungeonEdge(roomCells.getFirst(), roomCells.get(1))),
                new DungeonPrimitive(201L, "wall", "South Wall", new DungeonEdge(roomCells.get(2), roomCells.get(3)))
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

        DungeonMapFacts map = new DungeonMapFacts(
                topology.topology(),
                topology.width(),
                topology.height(),
                List.of(
                        new DungeonAreaFacts(room.kind(), room.id(), room.label(), room.cells()),
                        new DungeonAreaFacts(corridor.kind(), corridor.id(), corridor.label(), corridor.cells())
                ),
                List.of(
                        new DungeonBoundaryFacts(door.kind(), door.id(), door.label(), door.edge()),
                        new DungeonBoundaryFacts(walls.getFirst().kind(), walls.getFirst().id(), walls.getFirst().label(), walls.getFirst().edge()),
                        new DungeonBoundaryFacts(walls.get(1).kind(), walls.get(1).id(), walls.get(1).label(), walls.get(1).edge())
                )
        );

        List<DungeonPrimitive> primitives = new ArrayList<>();
        primitives.add(door);
        primitives.addAll(walls);
        return new DungeonDerivedState(map, List.of(room, corridor), primitives, relations);
    }

    private List<DungeonCell> buildRoomCells(SpatialTopology topology) {
        List<DungeonCell> cells = new ArrayList<>();
        for (int r = 0; r < 2; r++) {
            for (int q = 0; q < 3; q++) {
                cells.add(new DungeonCell(topology.roomAnchorQ() + q, topology.roomAnchorR() + r, 0));
            }
        }
        return List.copyOf(cells);
    }

    private List<DungeonCell> buildCorridorCells(SpatialTopology topology) {
        int startQ = topology.roomAnchorQ() + 1;
        int startR = topology.roomAnchorR() + 2;
        return List.of(
                new DungeonCell(startQ, startR, 0),
                new DungeonCell(startQ, startR + 1, 0),
                new DungeonCell(startQ, startR + 2, 0)
        );
    }
}
