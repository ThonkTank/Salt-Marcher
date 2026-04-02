package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

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

    String targetKey();

    String partKey();

    default DungeonSelectionKey selectionKey() {
        return new DungeonSelectionKey(kind(), targetKey(), partKey());
    }

    record VertexSubject(LegacyGridPoint2x vertex2x) implements DungeonHitSubject {
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
        public String targetKey() {
            return "";
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.vertexPartKey(vertex2x);
        }
    }

    record ClusterLabelSubject(Long clusterId) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CLUSTER_LABEL;
        }

        @Override
        public String targetKey() {
            return RoomCluster.targetKey(clusterId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.labelPartKey();
        }
    }

    record ClusterBoundarySubject(
            Long clusterId,
            LegacyGridSegment2x boundarySegment2x,
            InternalBoundaryType boundaryType,
            Point2i baseCell,
            Point2i direction
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
        public String targetKey() {
            return RoomCluster.targetKey(clusterId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.segment2xPartKey(boundarySegment2x);
        }
    }

    record RoomSubject(Long roomId, Long clusterId) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.ROOM;
        }

        @Override
        public String targetKey() {
            return Room.targetKey(roomId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.noPartKey();
        }
    }

    record RoomBoundarySubject(
            Long roomId,
            Long clusterId,
            LegacyGridSegment2x boundarySegment2x,
            Point2i roomCell,
            Point2i outwardStep,
            boolean exterior
    ) implements DungeonHitSubject {
        public RoomBoundarySubject {
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
            roomCell = Objects.requireNonNull(roomCell, "roomCell");
            outwardStep = Objects.requireNonNull(outwardStep, "outwardStep");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.ROOM_BOUNDARY;
        }

        @Override
        public String targetKey() {
            return Room.targetKey(roomId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.segment2xPartKey(boundarySegment2x);
        }
    }

    record ConnectionSubject(
            ConnectionKind connectionKind,
            Long clusterId,
            Long corridorId,
            LegacyGridSegment2x boundarySegment2x
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
        public String targetKey() {
            return switch (connectionKind) {
                case LOCAL -> RoomCluster.targetKey(clusterId);
                case CORRIDOR -> Corridor.targetKey(corridorId);
                case STAIR, TRANSITION -> throw new IllegalStateException(
                        "Unsupported connection kind for ConnectionSubject: " + connectionKind);
            };
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.segment2xPartKey(boundarySegment2x);
        }
    }

    record CorridorSubject(Long corridorId, int levelZ) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CORRIDOR;
        }

        @Override
        public String targetKey() {
            return Corridor.targetKey(corridorId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.noPartKey();
        }
    }

    record CorridorNodeSubject(Long corridorId, Long nodeId, LegacyGridPoint2x point2x) implements DungeonHitSubject {
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
        public String targetKey() {
            return Corridor.targetKey(corridorId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.nodePartKey(nodeId);
        }
    }

    record CorridorCornerSubject(Long corridorId, Long segmentId, LegacyGridPoint2x point2x) implements DungeonHitSubject {
        public CorridorCornerSubject {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.CORRIDOR_CORNER;
        }

        @Override
        public String targetKey() {
            return Corridor.targetKey(corridorId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.cornerPartKey(point2x);
        }
    }

    record CorridorSegmentSubject(Long corridorId, Long segmentId, LegacyGridPoint2x point2x) implements DungeonHitSubject {
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
        public String targetKey() {
            return Corridor.targetKey(corridorId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.segmentPartKey(segmentId);
        }
    }

    record StairSubject(Long stairId) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.STAIR;
        }

        @Override
        public String targetKey() {
            return DungeonStair.targetKey(stairId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.noPartKey();
        }
    }

    record TransitionSubject(Long transitionId) implements DungeonHitSubject {
        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.TRANSITION;
        }

        @Override
        public String targetKey() {
            return DungeonTransition.targetKey(transitionId);
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.noPartKey();
        }
    }

    record FloorCellSubject(Point2i cell, int levelZ) implements DungeonHitSubject {
        public FloorCellSubject {
            cell = Objects.requireNonNull(cell, "cell");
        }

        @Override
        public DungeonHitKind kind() {
            return DungeonHitKind.FLOOR_CELL;
        }

        @Override
        public String targetKey() {
            return "";
        }

        @Override
        public String partKey() {
            return DungeonHitConventions.cellPartKey(cell, levelZ);
        }
    }
}
