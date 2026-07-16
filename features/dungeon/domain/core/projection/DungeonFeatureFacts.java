package features.dungeon.domain.core.projection;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.domain.core.structure.transition.TransitionDestinationType;

public record DungeonFeatureFacts(
        DungeonFeatureType kind,
        long id,
        String label,
        List<Cell> cells,
        String description,
        String destinationLabel,
        StatePanelFacts statePanelFacts,
        DungeonTopologyRef topologyRef,
        @Nullable Edge anchorEdge
) {

    public DungeonFeatureFacts {
        kind = kind == null ? DungeonFeatureType.STAIR : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
        description = description == null ? "" : description.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        statePanelFacts = statePanelFacts == null ? StatePanelFacts.empty() : statePanelFacts;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public record StatePanelFacts(
            StairGeometryFacts stairGeometry,
            TransitionDestinationFacts transitionDestination
    ) {
        public StatePanelFacts {
            stairGeometry = stairGeometry == null ? StairGeometryFacts.empty() : stairGeometry;
            transitionDestination =
                    transitionDestination == null ? TransitionDestinationFacts.empty() : transitionDestination;
        }

        public static StatePanelFacts empty() {
            return new StatePanelFacts(StairGeometryFacts.empty(), TransitionDestinationFacts.empty());
        }

        public static StatePanelFacts stair(
                long stairId,
                StairShape shape,
                Direction direction,
                int dimension1,
                int dimension2
        ) {
            return new StatePanelFacts(
                    new StairGeometryFacts(true, stairId, shapeName(shape), directionName(direction),
                            dimension1, dimension2),
                    TransitionDestinationFacts.empty());
        }

        public static StatePanelFacts transition(TransitionDestination destination) {
            return new StatePanelFacts(
                    StairGeometryFacts.empty(),
                    TransitionDestinationFacts.from(destination));
        }

        private static String shapeName(StairShape shape) {
            return shape == null ? StairShape.STRAIGHT.name() : shape.name();
        }

        private static String directionName(Direction direction) {
            return direction == null ? Direction.NORTH.name() : direction.name();
        }
    }

    public record StairGeometryFacts(
            boolean present,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        public StairGeometryFacts {
            stairId = Math.max(0L, stairId);
            shapeName = shapeName == null || shapeName.isBlank() ? StairShape.STRAIGHT.name() : shapeName.strip();
            directionName = directionName == null || directionName.isBlank()
                    ? Direction.NORTH.name()
                    : directionName.strip();
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            present = present && stairId > 0L;
        }

        public static StairGeometryFacts empty() {
            return new StairGeometryFacts(false, 0L, "", "", 0, 0);
        }
    }

    public record TransitionDestinationFacts(
            boolean present,
            String destinationTypeKey,
            long mapId,
            long tileId,
            long transitionId
    ) {
        public TransitionDestinationFacts {
            destinationTypeKey = destinationTypeKey == null || destinationTypeKey.isBlank()
                    ? TransitionDestinationType.UNLINKED_ENTRANCE.name()
                    : destinationTypeKey.strip();
            mapId = Math.max(0L, mapId);
            tileId = Math.max(0L, tileId);
            transitionId = Math.max(0L, transitionId);
        }

        public static TransitionDestinationFacts empty() {
            return new TransitionDestinationFacts(
                    false,
                    TransitionDestinationType.UNLINKED_ENTRANCE.name(),
                    0L,
                    0L,
                    0L);
        }

        public static TransitionDestinationFacts from(TransitionDestination destination) {
            TransitionDestination safeDestination = destination == null
                    ? TransitionDestination.unlinkedEntrance()
                    : destination;
            Long transitionId = safeDestination.transitionId();
            return new TransitionDestinationFacts(
                    true,
                    safeDestination.type().name(),
                    safeDestination.mapId(),
                    safeDestination.tileId(),
                    transitionId == null ? 0L : transitionId);
        }
    }

}
