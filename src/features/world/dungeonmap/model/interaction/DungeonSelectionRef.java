package features.world.dungeonmap.model.interaction;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;

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
        DungeonSelectionRef.ConnectionRef,
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
            case ConnectionRef ignored -> DungeonHitKind.CONNECTION;
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
     * Selection refs carry typed ownership directly so callers can compare semantic owners without reconstructing
     * generic ids or parsing intermediate keys.
     */
    default DungeonSelectionRef ownerRef() {
        return null;
    }

    default boolean sameOwnerAs(DungeonSelectionRef other) {
        if (other == null) {
            return false;
        }
        DungeonSelectionRef leftOwner = ownerRef();
        DungeonSelectionRef rightOwner = other.ownerRef();
        return leftOwner != null && Objects.equals(leftOwner, rightOwner);
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

    record VertexRef(GridPoint2x vertex2x) implements DungeonSelectionRef {
        public VertexRef {
            vertex2x = Objects.requireNonNull(vertex2x, "vertex2x");
        }
    }

    record RoomBoundaryRef(Long roomId, GridSegment2x boundarySegment2x) implements DungeonSelectionRef {
        public RoomBoundaryRef {
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return roomId == null ? null : new RoomRef(roomId);
        }
    }

    record CorridorBoundaryRef(Long corridorId, GridSegment2x boundarySegment2x) implements DungeonSelectionRef {
        public CorridorBoundaryRef {
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record ConnectionRef(
            ConnectionKind connectionKind,
            Long ownerId,
            GridSegment2x boundarySegment2x
    ) implements DungeonSelectionRef {
        public ConnectionRef {
            connectionKind = Objects.requireNonNull(connectionKind, "connectionKind");
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return switch (connectionKind) {
                case LOCAL -> ownerId == null ? null : new ClusterRef(ownerId);
                case CORRIDOR -> ownerId == null ? null : new CorridorRef(ownerId);
                case STAIR -> ownerId == null ? null : new StairRef(ownerId);
                case TRANSITION -> ownerId == null ? null : new TransitionRef(ownerId);
            };
        }
    }

    record CorridorTileRef(Long corridorId, CubePoint cell, GridPoint2x point2x) implements DungeonSelectionRef {
        public CorridorTileRef {
            cell = Objects.requireNonNull(cell, "cell");
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record CorridorNodeRef(Long corridorId, Long nodeId, GridPoint2x point2x) implements DungeonSelectionRef {
        public CorridorNodeRef {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record CorridorCornerRef(Long corridorId, Long segmentId, GridPoint2x point2x) implements DungeonSelectionRef {
        public CorridorCornerRef {
            if (segmentId == null) {
                throw new IllegalArgumentException("Corridor corner refs require segmentId");
            }
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record CorridorSegmentRef(Long corridorId, Long segmentId, GridPoint2x point2x) implements DungeonSelectionRef {
        public CorridorSegmentRef {
            if (segmentId == null) {
                throw new IllegalArgumentException("Corridor segment refs require segmentId");
            }
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record GridCellRef(CubePoint cell) implements DungeonSelectionRef {
        public GridCellRef {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    record RoomCellRef(Long roomId, CubePoint cell) implements DungeonSelectionRef {
        public RoomCellRef {
            cell = Objects.requireNonNull(cell, "cell");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return roomId == null ? null : new RoomRef(roomId);
        }
    }

    record FloorCellRef(CubePoint cell) implements DungeonSelectionRef {
        public FloorCellRef {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }
}
