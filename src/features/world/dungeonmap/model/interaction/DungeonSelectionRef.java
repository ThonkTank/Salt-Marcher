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

    default Long clusterOwnerId() {
        return null;
    }

    default Long roomOwnerId() {
        return null;
    }

    default Long corridorOwnerId() {
        return null;
    }

    default Long stairOwnerId() {
        return null;
    }

    default Long transitionOwnerId() {
        return null;
    }

    record ClusterRef(Long clusterId) implements DungeonSelectionRef {
        @Override
        public Long clusterOwnerId() {
            return clusterId;
        }
    }

    record RoomRef(Long roomId) implements DungeonSelectionRef {
        @Override
        public Long roomOwnerId() {
            return roomId;
        }
    }

    record CorridorRef(Long corridorId) implements DungeonSelectionRef {
        @Override
        public Long corridorOwnerId() {
            return corridorId;
        }
    }

    record StairRef(Long stairId) implements DungeonSelectionRef {
        @Override
        public Long stairOwnerId() {
            return stairId;
        }
    }

    record TransitionRef(Long transitionId) implements DungeonSelectionRef {
        @Override
        public Long transitionOwnerId() {
            return transitionId;
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
        public Long clusterOwnerId() {
            return clusterId;
        }
    }

    record RoomBoundaryRef(Long roomId, GridSegment2x boundarySegment2x) implements DungeonSelectionRef {
        public RoomBoundaryRef {
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
        }

        @Override
        public Long roomOwnerId() {
            return roomId;
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
        public Long clusterOwnerId() {
            return connectionKind == ConnectionKind.LOCAL ? clusterId : null;
        }

        @Override
        public Long corridorOwnerId() {
            return connectionKind == ConnectionKind.CORRIDOR ? corridorId : null;
        }
    }

    record CorridorNodeRef(Long corridorId, Long nodeId, GridPoint2x point2x) implements DungeonSelectionRef {
        public CorridorNodeRef {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public Long corridorOwnerId() {
            return corridorId;
        }
    }

    record CorridorCornerRef(Long corridorId, GridPoint2x point2x) implements DungeonSelectionRef {
        public CorridorCornerRef {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public Long corridorOwnerId() {
            return corridorId;
        }
    }

    record CorridorSegmentRef(Long corridorId, Long segmentId) implements DungeonSelectionRef {
        @Override
        public Long corridorOwnerId() {
            return corridorId;
        }
    }

    record FloorCellRef(CubePoint cell) implements DungeonSelectionRef {
        public FloorCellRef {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }
}
