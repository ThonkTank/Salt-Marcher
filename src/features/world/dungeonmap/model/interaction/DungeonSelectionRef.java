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
        DungeonSelectionRef.ClusterBoundaryRef,
        DungeonSelectionRef.RoomBoundaryRef,
        DungeonSelectionRef.ConnectionRef,
        DungeonSelectionRef.CorridorNodeRef,
        DungeonSelectionRef.CorridorCornerRef,
        DungeonSelectionRef.CorridorSegmentRef,
        DungeonSelectionRef.FloorCellRef {

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

    record ClusterBoundaryRef(Long clusterId, GridSegment2x boundarySegment2x) implements DungeonSelectionRef {
        public ClusterBoundaryRef {
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return clusterId == null ? null : new ClusterRef(clusterId);
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

    record ConnectionRef(
            ConnectionKind connectionKind,
            Long clusterId,
            Long corridorId,
            GridSegment2x boundarySegment2x
    ) implements DungeonSelectionRef {
        public ConnectionRef {
            connectionKind = Objects.requireNonNull(connectionKind, "connectionKind");
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return switch (connectionKind) {
                case LOCAL -> clusterId == null ? null : new ClusterRef(clusterId);
                case CORRIDOR -> corridorId == null ? null : new CorridorRef(corridorId);
                case STAIR, TRANSITION -> null;
            };
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

    record CorridorCornerRef(Long corridorId, GridPoint2x point2x) implements DungeonSelectionRef {
        public CorridorCornerRef {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record CorridorSegmentRef(Long corridorId, Long segmentId) implements DungeonSelectionRef {
        @Override
        public DungeonSelectionRef ownerRef() {
            return corridorId == null ? null : new CorridorRef(corridorId);
        }
    }

    record FloorCellRef(CubePoint cell) implements DungeonSelectionRef {
        public FloorCellRef {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }
}
