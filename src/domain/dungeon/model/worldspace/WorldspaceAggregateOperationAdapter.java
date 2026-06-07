package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

/**
 * Transitional bridge from the core aggregate shell to residual worldspace
 * operation collaborators.
 *
 * <p>Delete this adapter when room, handle, and stair-interior
 * operations move to their core structure/runtime owners and the aggregate no
 * longer calls worldspace operation code.
 */
public final class WorldspaceAggregateOperationAdapter {

    private static final DungeonRoomTopologyEditor ROOM_TOPOLOGY_EDITOR = new DungeonRoomTopologyEditor();
    private static final DungeonEditorHandleMovementLogic HANDLE_MOVEMENT = new DungeonEditorHandleMovementLogic();
    private static final StairRoomInteriorCells STAIR_ROOM_INTERIOR_CELLS = new StairRoomInteriorCells();

    public DungeonMap moveEditorHandle(
            DungeonMap map,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return HANDLE_MOVEMENT.moveEditorHandle(map, handle, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveBoundaryStretch(
            DungeonMap map,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return ROOM_TOPOLOGY_EDITOR.moveBoundaryStretch(map, clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
    }

    public Set<Cell> stairRoomInteriorCells(SpatialTopology topology, RoomCatalog rooms) {
        return STAIR_ROOM_INTERIOR_CELLS.from(topology, rooms);
    }

    public DungeonMap paintRoomRectangle(DungeonMap map, Cell start, Cell end) {
        return ROOM_TOPOLOGY_EDITOR.paintRectangle(map, start, end);
    }

    public DungeonMap deleteRoomRectangle(DungeonMap map, Cell start, Cell end) {
        return ROOM_TOPOLOGY_EDITOR.deleteRectangle(map, start, end);
    }

    public DungeonMap editClusterBoundaries(
            DungeonMap map,
            long clusterId,
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary
    ) {
        return ROOM_TOPOLOGY_EDITOR.editBoundaries(map, clusterId, edges, kind, deleteBoundary);
    }

}
