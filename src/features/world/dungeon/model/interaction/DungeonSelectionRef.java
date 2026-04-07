package features.world.dungeon.model.interaction;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import java.util.Objects;

public sealed interface DungeonSelectionRef permits
        DungeonSelectionRef.ClusterRef,
        DungeonSelectionRef.RoomRef,
        DungeonSelectionRef.CorridorRef,
        DungeonSelectionRef.StairRef,
        DungeonSelectionRef.TransitionRef,
        DungeonSelectionRef.VertexRef,
        DungeonSelectionRef.RoomBoundaryRef,
        DungeonSelectionRef.CorridorBoundaryRef,
        DungeonSelectionRef.DoorRef,
        DungeonSelectionRef.CorridorTileRef,
        DungeonSelectionRef.CorridorNodeRef,
        DungeonSelectionRef.CorridorCornerRef,
        DungeonSelectionRef.CorridorSegmentRef,
        DungeonSelectionRef.GridCellRef,
        DungeonSelectionRef.RoomCellRef,
        DungeonSelectionRef.FloorCellRef {

    /**
     * Selection refs are the single interaction seam for hit collection, hover, and persisted selection state.
     * Hit ordering still keys off the concrete ref variant instead of a parallel shell-only subject hierarchy.
     */
    default DungeonHitKind kind() {
        return switch (this) {
            case ClusterRef ignored -> DungeonHitKind.CLUSTER_LABEL;
            case RoomRef ignored -> DungeonHitKind.ROOM;
            case CorridorRef ignored -> DungeonHitKind.CORRIDOR;
            case StairRef ignored -> DungeonHitKind.STAIR;
            case TransitionRef ignored -> DungeonHitKind.TRANSITION;
            case VertexRef ignored -> DungeonHitKind.VERTEX;
            case RoomBoundaryRef ignored -> DungeonHitKind.ROOM_BOUNDARY;
            case CorridorBoundaryRef ignored -> DungeonHitKind.CORRIDOR_BOUNDARY;
            case DoorRef ignored -> DungeonHitKind.DOOR;
            case CorridorTileRef ignored -> DungeonHitKind.CORRIDOR_TILE;
            case CorridorNodeRef ignored -> DungeonHitKind.CORRIDOR_NODE;
            case CorridorCornerRef ignored -> DungeonHitKind.CORRIDOR_CORNER;
            case CorridorSegmentRef ignored -> DungeonHitKind.CORRIDOR_SEGMENT;
            case GridCellRef ignored -> DungeonHitKind.GRID_CELL;
            case RoomCellRef ignored -> DungeonHitKind.ROOM_CELL;
            case FloorCellRef ignored -> DungeonHitKind.FLOOR_CELL;
        };
    }

    /**
     * Non-door refs may expose their semantic owner directly. Door refs stay as pure identity and rely on
     * `DungeonMap` to resolve current owner semantics from the live door classification.
     */
    default DungeonSelectionRef ownerRef() {
        return null;
    }

    record ClusterRef(Long clusterId) implements DungeonSelectionRef {
        @Override
        public DungeonSelectionRef ownerRef() {
            return clusterId == null ? null : this;
        }
    }

    record RoomRef(Long roomId) implements DungeonSelectionRef {
        @Override
        public DungeonSelectionRef ownerRef() {
            return roomId == null ? null : this;
        }
    }

    record CorridorRef(Long corridorId) implements DungeonSelectionRef {
        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : this;
        }
    }

    record StairRef(Long stairId) implements DungeonSelectionRef {
        @Override
        public DungeonSelectionRef ownerRef() {
            return stairId == null ? null : this;
        }
    }

    record TransitionRef(Long transitionId) implements DungeonSelectionRef {
        @Override
        public DungeonSelectionRef ownerRef() {
            return transitionId == null ? null : this;
        }
    }

    record VertexRef(GridPoint vertex) implements DungeonSelectionRef {
        public VertexRef {
            vertex = Objects.requireNonNull(vertex, "vertex");
        }
    }

    record RoomBoundaryRef(Long roomId, GridSegment boundarySegment) implements DungeonSelectionRef {
        public RoomBoundaryRef {
            boundarySegment = Objects.requireNonNull(boundarySegment, "boundarySegment");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return roomId == null ? null : new RoomRef(roomId);
        }
    }

    record CorridorBoundaryRef(Long corridorId, GridSegment boundarySegment) implements DungeonSelectionRef {
        public CorridorBoundaryRef {
            boundarySegment = Objects.requireNonNull(boundarySegment, "boundarySegment");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record DoorRef(long doorId) implements DungeonSelectionRef {
        public DoorRef {
            if (doorId <= 0) {
                throw new IllegalArgumentException("Door refs require doorId");
            }
        }
    }

    record CorridorTileRef(Long corridorId, GridPoint cell, GridPoint point) implements DungeonSelectionRef {
        public CorridorTileRef {
            cell = Objects.requireNonNull(cell, "cell");
            point = Objects.requireNonNull(point, "point");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record CorridorNodeRef(Long corridorId, Long nodeId, GridPoint point) implements DungeonSelectionRef {
        public CorridorNodeRef {
            point = Objects.requireNonNull(point, "point");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record CorridorCornerRef(Long corridorId, Long segmentId, GridPoint point) implements DungeonSelectionRef {
        public CorridorCornerRef {
            if (segmentId == null) {
                throw new IllegalArgumentException("Corridor corner refs require segmentId");
            }
            point = Objects.requireNonNull(point, "point");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record CorridorSegmentRef(Long corridorId, Long segmentId, GridPoint point) implements DungeonSelectionRef {
        public CorridorSegmentRef {
            if (segmentId == null) {
                throw new IllegalArgumentException("Corridor segment refs require segmentId");
            }
            point = Objects.requireNonNull(point, "point");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record GridCellRef(GridPoint cell) implements DungeonSelectionRef {
        public GridCellRef {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    record RoomCellRef(Long roomId, GridPoint cell) implements DungeonSelectionRef {
        public RoomCellRef {
            cell = Objects.requireNonNull(cell, "cell");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return roomId == null ? null : new RoomRef(roomId);
        }
    }

    record FloorCellRef(GridPoint cell) implements DungeonSelectionRef {
        public FloorCellRef {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }
}
