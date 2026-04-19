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
import src.domain.mapcore.api.MapCellSnapshot;
import src.domain.mapcore.api.MapCellStyle;
import src.domain.mapcore.api.MapEdgeSnapshot;
import src.domain.mapcore.api.MapEdgeRef;
import src.domain.mapcore.api.MapLayerSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.domain.mapcore.api.MapSurfaceSnapshot;

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
        DungeonDoorPrimitive door = new DungeonDoorPrimitive(100L, "Oak Door", new MapEdgeRef(roomCells.get(3).toMapCellRef(), corridorCells.getFirst().toMapCellRef()));

        List<DungeonWallPrimitive> walls = List.of(
                new DungeonWallPrimitive(200L, new MapEdgeRef(roomCells.getFirst().toMapCellRef(), roomCells.get(1).toMapCellRef())),
                new DungeonWallPrimitive(201L, new MapEdgeRef(roomCells.get(2).toMapCellRef(), roomCells.get(3).toMapCellRef()))
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

        MapSelectionRef roomSelection = new MapSelectionRef("room", room.id(), "aggregate", room.label());
        MapSelectionRef corridorSelection = new MapSelectionRef("corridor", corridor.id(), "aggregate", corridor.label());
        MapSelectionRef doorSelection = new MapSelectionRef(DOOR_KIND, door.id(), "primitive", door.label());

        MapSurfaceSnapshot surface = new MapSurfaceSnapshot(
                document.mapName(),
                document.topology(),
                document.width(),
                document.height(),
                List.of(
                        new MapLayerSnapshot("rooms", "Rooms", roomCells.stream()
                                .map(cell -> new MapCellSnapshot(cell.toMapCellRef(), room.label(), MapCellStyle.roomStyle(), roomSelection))
                                .toList()),
                        new MapLayerSnapshot("corridors", "Corridors", corridorCells.stream()
                                .map(cell -> new MapCellSnapshot(cell.toMapCellRef(), corridor.label(), MapCellStyle.corridorStyle(), corridorSelection))
                                .toList())
                ),
                List.of(
                        new MapEdgeSnapshot(door.edge(), DOOR_KIND, door.label(), doorSelection),
                        new MapEdgeSnapshot(walls.getFirst().edge(), "wall", "North Wall", null),
                        new MapEdgeSnapshot(walls.get(1).edge(), "wall", "South Wall", null)
                ),
                List.of(
                        roomSelection,
                        corridorSelection,
                        doorSelection
                )
        );

        List<Object> primitives = new ArrayList<>();
        primitives.add(door);
        primitives.addAll(walls);
        return new DungeonDerivedState(surface, List.of(room, corridor), primitives.stream()
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
