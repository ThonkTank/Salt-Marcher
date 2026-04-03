package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonHitKind;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;

import java.util.Objects;

public sealed interface DungeonHitSubject permits DungeonHitSubject.VertexSubject,
        DungeonHitSubject.ClusterLabelSubject,
        DungeonHitSubject.ClusterBoundarySubject,
        DungeonHitSubject.RoomSubject,
        DungeonHitSubject.RoomBoundarySubject,
        DungeonHitSubject.ConnectionSubject,
        DungeonHitSubject.CorridorSubject,
        DungeonHitSubject.CorridorNodeSubject,
        DungeonHitSubject.CorridorCornerSubject,
        DungeonHitSubject.CorridorSegmentSubject,
        DungeonHitSubject.StairSubject,
        DungeonHitSubject.TransitionSubject,
        DungeonHitSubject.FloorCellSubject {

    DungeonHitKind kind();

    DungeonSelectionRef ref();

    default DungeonSelectionRef ownerRef() {
        return ref();
    }

    record VertexSubject(GridPoint2x vertex2x) implements DungeonHitSubject {
        public VertexSubject {
            vertex2x = Objects.requireNonNull(vertex2x, "vertex2x");
            if (!vertex2x.isVertex()) {
                throw new IllegalArgumentException("VertexSubject requires a vertex point");
            }
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.VERTEX;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.VertexRef(vertex2x);
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return null;
        }
    }

    record ClusterLabelSubject(Long clusterId) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CLUSTER_LABEL;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.ClusterRef(clusterId);
        }
    }

    record ClusterBoundarySubject(
            Long clusterId,
            GridSegment2x boundarySegment2x,
            InternalBoundaryType boundaryType,
            CellCoord baseCell,
            CardinalDirection direction
    ) implements DungeonHitSubject {
        public ClusterBoundarySubject {
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
            boundaryType = boundaryType == null ? InternalBoundaryType.WALL : boundaryType;
            baseCell = Objects.requireNonNull(baseCell, "baseCell");
            direction = Objects.requireNonNull(direction, "direction");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CLUSTER_BOUNDARY;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.ClusterBoundaryRef(clusterId, boundarySegment2x);
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return new DungeonSelectionRef.ClusterRef(clusterId);
        }
    }

    record RoomSubject(Long roomId, Long clusterId) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.ROOM;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.RoomRef(roomId);
        }
    }

    record RoomBoundarySubject(
            Long roomId,
            Long clusterId,
            GridSegment2x boundarySegment2x,
            CellCoord roomCell,
            CardinalDirection outwardDirection,
            boolean exterior
    ) implements DungeonHitSubject {
        public RoomBoundarySubject {
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
            roomCell = Objects.requireNonNull(roomCell, "roomCell");
            outwardDirection = Objects.requireNonNull(outwardDirection, "outwardDirection");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.ROOM_BOUNDARY;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.RoomBoundaryRef(roomId, boundarySegment2x);
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return new DungeonSelectionRef.RoomRef(roomId);
        }
    }

    record ConnectionSubject(
            ConnectionKind connectionKind,
            Long clusterId,
            Long corridorId,
            GridSegment2x boundarySegment2x
    ) implements DungeonHitSubject {
        public ConnectionSubject {
            connectionKind = Objects.requireNonNull(connectionKind, "connectionKind");
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
            switch (connectionKind) {
                case LOCAL -> {
                    if (clusterId == null) {
                        throw new IllegalArgumentException("LOCAL connection subjects require clusterId");
                    }
                }
                case CORRIDOR -> {
                    if (corridorId == null) {
                        throw new IllegalArgumentException("CORRIDOR connection subjects require corridorId");
                    }
                }
                case STAIR, TRANSITION -> throw new IllegalArgumentException(
                        "ConnectionSubject supports only LOCAL and CORRIDOR connections");
            }
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CONNECTION;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.ConnectionRef(connectionKind, clusterId, corridorId, boundarySegment2x);
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return switch (connectionKind) {
                case LOCAL -> new DungeonSelectionRef.ClusterRef(clusterId);
                case CORRIDOR -> new DungeonSelectionRef.CorridorRef(corridorId);
                case STAIR, TRANSITION -> null;
            };
        }
    }

    record CorridorSubject(Long corridorId, int levelZ) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CORRIDOR;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.CorridorRef(corridorId);
        }
    }

    record CorridorNodeSubject(Long corridorId, Long nodeId, GridPoint2x point2x) implements DungeonHitSubject {
        public CorridorNodeSubject {
            if (nodeId == null) {
                throw new IllegalArgumentException("Corridor node subjects require nodeId");
            }
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CORRIDOR_NODE;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.CorridorNodeRef(corridorId, nodeId, point2x);
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return new DungeonSelectionRef.CorridorRef(corridorId);
        }
    }

    record CorridorCornerSubject(Long corridorId, Long segmentId, GridPoint2x point2x) implements DungeonHitSubject {
        public CorridorCornerSubject {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CORRIDOR_CORNER;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.CorridorCornerRef(corridorId, point2x);
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return new DungeonSelectionRef.CorridorRef(corridorId);
        }
    }

    record CorridorSegmentSubject(Long corridorId, Long segmentId, GridPoint2x point2x) implements DungeonHitSubject {
        public CorridorSegmentSubject {
            if (segmentId == null) {
                throw new IllegalArgumentException("Corridor segment subjects require segmentId");
            }
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CORRIDOR_SEGMENT;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.CorridorSegmentRef(corridorId, segmentId);
        }

        @Override
        public DungeonSelectionRef ownerRef() {
            return new DungeonSelectionRef.CorridorRef(corridorId);
        }
    }

    record StairSubject(Long stairId) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.STAIR;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.StairRef(stairId);
        }
    }

    record TransitionSubject(Long transitionId) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.TRANSITION;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.TransitionRef(transitionId);
        }
    }

    record FloorCellSubject(CellCoord cell, int levelZ) implements DungeonHitSubject {
        public FloorCellSubject {
            cell = Objects.requireNonNull(cell, "cell");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.FLOOR_CELL;
        }

        @Override
        public DungeonSelectionRef ref() {
            return new DungeonSelectionRef.FloorCellRef(CubePoint.at(cell, levelZ));
        }
    }
}
