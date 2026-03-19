package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.List;
import java.util.Objects;
import java.util.Set;

public sealed interface DungeonEditorEditCommand permits
        DungeonEditorEditCommand.MoveCluster,
        DungeonEditorEditCommand.PaintRoomCells,
        DungeonEditorEditCommand.CreateGraphRoom,
        DungeonEditorEditCommand.DeleteRoomsAtCells,
        DungeonEditorEditCommand.DeleteGraphCluster,
        DungeonEditorEditCommand.ApplyWallPath,
        DungeonEditorEditCommand.PaintClusterDoors,
        DungeonEditorEditCommand.DeleteClusterDoors,
        DungeonEditorEditCommand.CreateCorridor,
        DungeonEditorEditCommand.AddRoomToCorridor,
        DungeonEditorEditCommand.MergeCorridors,
        DungeonEditorEditCommand.RemoveRoomFromCorridors,
        DungeonEditorEditCommand.DeleteCorridor,
        DungeonEditorEditCommand.MoveCorridorDoor,
        DungeonEditorEditCommand.ResetCorridorDoor,
        DungeonEditorEditCommand.AddCorridorWaypoint,
        DungeonEditorEditCommand.MoveCorridorWaypoint,
        DungeonEditorEditCommand.DeleteCorridorWaypoint {

    record MoveCluster(long clusterId, Point2i center) implements DungeonEditorEditCommand {
        public MoveCluster {
            Objects.requireNonNull(center, "center");
        }
    }

    record PaintRoomCells(Set<Point2i> cells) implements DungeonEditorEditCommand {
        public PaintRoomCells {
            Objects.requireNonNull(cells, "cells");
            if (cells.isEmpty()) throw new IllegalArgumentException("cells must not be empty");
            cells = Set.copyOf(cells);
        }
    }

    record CreateGraphRoom(Point2i center) implements DungeonEditorEditCommand {
        public CreateGraphRoom {
            Objects.requireNonNull(center, "center");
        }
    }

    record DeleteRoomsAtCells(Set<Point2i> cells) implements DungeonEditorEditCommand {
        public DeleteRoomsAtCells {
            Objects.requireNonNull(cells, "cells");
            if (cells.isEmpty()) throw new IllegalArgumentException("cells must not be empty");
            cells = Set.copyOf(cells);
        }
    }

    record DeleteGraphCluster(long clusterId) implements DungeonEditorEditCommand {
    }

    // deleteMode flag retained: paint and delete share identical handler logic (same edge resolution,
    // same topology update path) — splitting into two records would duplicate that logic without benefit.
    record ApplyWallPath(Set<DungeonClusterEdgeRef> edgeRefs, boolean deleteMode) implements DungeonEditorEditCommand {
        public ApplyWallPath {
            Objects.requireNonNull(edgeRefs, "edgeRefs");
            if (edgeRefs.isEmpty()) throw new IllegalArgumentException("edgeRefs must not be empty");
            edgeRefs = Set.copyOf(edgeRefs);
        }
    }

    record PaintClusterDoors(Set<DungeonClusterEdgeRef> edgeRefs) implements DungeonEditorEditCommand {
        public PaintClusterDoors {
            Objects.requireNonNull(edgeRefs, "edgeRefs");
            if (edgeRefs.isEmpty()) throw new IllegalArgumentException("edgeRefs must not be empty");
            edgeRefs = Set.copyOf(edgeRefs);
        }
    }

    record DeleteClusterDoors(Set<DungeonClusterEdgeRef> edgeRefs) implements DungeonEditorEditCommand {
        public DeleteClusterDoors {
            Objects.requireNonNull(edgeRefs, "edgeRefs");
            if (edgeRefs.isEmpty()) throw new IllegalArgumentException("edgeRefs must not be empty");
            edgeRefs = Set.copyOf(edgeRefs);
        }
    }

    record CreateCorridor(List<Long> roomIds) implements DungeonEditorEditCommand {
        public CreateCorridor {
            Objects.requireNonNull(roomIds, "roomIds");
            if (roomIds.size() < 2) throw new IllegalArgumentException("roomIds must contain at least 2 entries");
            roomIds = List.copyOf(roomIds);
        }
    }

    record AddRoomToCorridor(long corridorId, long roomId) implements DungeonEditorEditCommand {
    }

    record MergeCorridors(long keptCorridorId, long mergedCorridorId) implements DungeonEditorEditCommand {
    }

    record RemoveRoomFromCorridors(List<Long> corridorIds, long roomId) implements DungeonEditorEditCommand {
        public RemoveRoomFromCorridors {
            Objects.requireNonNull(corridorIds, "corridorIds");
            if (corridorIds.isEmpty()) throw new IllegalArgumentException("corridorIds must not be empty");
            corridorIds = List.copyOf(corridorIds);
        }
    }

    record DeleteCorridor(long corridorId) implements DungeonEditorEditCommand {
    }

    record MoveCorridorDoor(
            long corridorId,
            long roomId,
            Point2i cell,
            DungeonRoomCluster.EdgeDirection direction
    ) implements DungeonEditorEditCommand {
        public MoveCorridorDoor {
            Objects.requireNonNull(cell, "cell");
            Objects.requireNonNull(direction, "direction");
        }
    }

    record ResetCorridorDoor(long corridorId, long roomId) implements DungeonEditorEditCommand {
    }

    record AddCorridorWaypoint(long corridorId, int insertIndex, Point2i cell) implements DungeonEditorEditCommand {
        public AddCorridorWaypoint {
            Objects.requireNonNull(cell, "cell");
        }
    }

    record MoveCorridorWaypoint(long corridorId, int waypointIndex, Point2i cell) implements DungeonEditorEditCommand {
        public MoveCorridorWaypoint {
            Objects.requireNonNull(cell, "cell");
        }
    }

    record DeleteCorridorWaypoint(long corridorId, int waypointIndex) implements DungeonEditorEditCommand {
    }
}
