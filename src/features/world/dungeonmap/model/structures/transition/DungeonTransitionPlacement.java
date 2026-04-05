package features.world.dungeonmap.model.structures.transition;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public sealed interface DungeonTransitionPlacement
        permits DungeonTransitionPlacement.DoorPlacement, DungeonTransitionPlacement.StairPlacement {

    int primaryLevelZ();

    default Set<Integer> occupiedLevels() {
        return Set.of(primaryLevelZ());
    }

    default Set<CubePoint> occupiedPositions() {
        return Set.of();
    }

    default CubePoint entryPoint(DungeonLayout layout) {
        return null;
    }

    default CardinalDirection entryHeading(DungeonLayout layout) {
        return null;
    }

    default InteractiveLabelHandle labelHandle(Long transitionId, String label) {
        return null;
    }

    record DoorPlacement(
            ConnectionEndpoint sourceEndpoint,
            GridSegment2x boundarySegment2x,
            int levelZ
    ) implements DungeonTransitionPlacement {

        public DoorPlacement {
            sourceEndpoint = Objects.requireNonNull(sourceEndpoint, "sourceEndpoint");
            boundarySegment2x = Objects.requireNonNull(boundarySegment2x, "boundarySegment2x");
            if (sourceEndpoint.id() == null) {
                throw new IllegalArgumentException("Door transition source endpoint requires id");
            }
            if (sourceEndpoint.type() != ConnectionEndpointType.ROOM
                    && sourceEndpoint.type() != ConnectionEndpointType.CORRIDOR) {
                throw new IllegalArgumentException("Door transition source endpoint must be ROOM or CORRIDOR");
            }
            if (!boundarySegment2x.isBoundaryEdge()) {
                throw new IllegalArgumentException("Door transition placement requires boundary segment");
            }
        }

        @Override
        public int primaryLevelZ() {
            return levelZ;
        }

        @Override
        public CubePoint entryPoint(DungeonLayout layout) {
            CellCoord entryCell = entryCell(layout);
            return entryCell == null ? null : CubePoint.at(entryCell, levelZ);
        }

        @Override
        public CardinalDirection entryHeading(DungeonLayout layout) {
            CellCoord entryCell = entryCell(layout);
            return entryCell == null ? null : boundarySegment2x.directionFrom(entryCell);
        }

        @Override
        public InteractiveLabelHandle labelHandle(Long transitionId, String label) {
            if (transitionId == null) {
                return null;
            }
            return new InteractiveLabelHandle(
                    new DungeonSelectionRef.TransitionRef(transitionId),
                    label,
                    boundarySegment2x.midpoint());
        }

        private CellCoord entryCell(DungeonLayout layout) {
            if (layout == null) {
                return null;
            }
            return switch (sourceEndpoint.type()) {
                case ROOM -> {
                    DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(
                            new DungeonSelectionRef.RoomBoundaryRef(sourceEndpoint.id(), boundarySegment2x),
                            levelZ);
                    yield boundary == null ? null : boundary.roomCell();
                }
                case CORRIDOR -> {
                    DungeonLayout.CorridorBoundaryDescription boundary = layout.describeCorridorBoundary(
                            new DungeonSelectionRef.CorridorBoundaryRef(sourceEndpoint.id(), boundarySegment2x),
                            levelZ);
                    yield boundary == null ? null : boundary.corridorCell();
                }
                default -> null;
            };
        }
    }

    record StairPlacement(
            CellCoord anchorCell,
            int anchorLevelZ,
            StairShape shape,
            CardinalDirection direction,
            int minLevelZ,
            int maxLevelZ,
            int dimension1,
            int dimension2,
            List<CubePoint> path,
            Set<Integer> stopLevels
    ) implements DungeonTransitionPlacement {

        public StairPlacement {
            anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
            shape = shape == null ? StairShape.LADDER : shape;
            direction = direction == null ? CardinalDirection.defaultDirection() : direction;
            path = path == null ? List.of() : List.copyOf(path.stream().filter(Objects::nonNull).toList());
            stopLevels = stopLevels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(stopLevels));
            if (path.isEmpty()) {
                throw new IllegalArgumentException("Transition stair path fehlt");
            }
        }

        @Override
        public int primaryLevelZ() {
            return anchorLevelZ;
        }

        @Override
        public Set<Integer> occupiedLevels() {
            LinkedHashSet<Integer> levels = new LinkedHashSet<>();
            for (CubePoint point : path) {
                levels.add(point.z());
            }
            return levels.isEmpty() ? Set.of(anchorLevelZ) : Set.copyOf(levels);
        }

        @Override
        public Set<CubePoint> occupiedPositions() {
            return Set.copyOf(new LinkedHashSet<>(path));
        }

        @Override
        public CubePoint entryPoint(DungeonLayout layout) {
            return CubePoint.at(anchorCell, anchorLevelZ);
        }

        @Override
        public InteractiveLabelHandle labelHandle(Long transitionId, String label) {
            if (transitionId == null) {
                return null;
            }
            return new InteractiveLabelHandle(
                    new DungeonSelectionRef.TransitionRef(transitionId),
                    label,
                    GridPoint2x.cell(anchorCell));
        }

        public DungeonStair asStair(Long stairId, long mapId, String name) {
            return DungeonStair.resolved(stairId, mapId, name, path, stopLevels);
        }
    }
}
