package features.world.dungeonmap.model.structures.transition;

import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.connection.StairConnectionCarrier;

public record DungeonTransition(
        Long transitionId,
        long mapId,
        String description,
        DungeonConnection localConnection,
        DungeonTransitionDestination destination,
        Long linkedTransitionId
) {
    public DungeonTransition {
        description = description == null ? "" : description.trim();
    }

    public String label() {
        return "Übergang " + (transitionId == null ? "neu" : transitionId);
    }

    public boolean isPlaced() {
        return localConnection != null;
    }

    public boolean isLinked() {
        return linkedTransitionId != null && linkedTransitionId > 0;
    }

    public DungeonTransition withLocalConnection(DungeonConnection localConnection) {
        return new DungeonTransition(transitionId, mapId, description, localConnection, destination, linkedTransitionId);
    }

    public InteractiveLabelHandle labelHandle(DungeonLayout layout) {
        if (localConnection == null || transitionId == null) {
            return null;
        }
        if (localConnection.doorCarrier() != null) {
            GridSegment anchorSegment = localConnection.anchorSegment(layout);
            if (anchorSegment == null) {
                return null;
            }
            return new InteractiveLabelHandle(
                    new DungeonSelectionRef.TransitionRef(transitionId),
                    label(),
                    anchorSegment.midpoint());
        }
        StairConnectionCarrier stairCarrier = localConnection.stairCarrier();
        if (stairCarrier == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.TransitionRef(transitionId),
                label(),
                GridPoint.cell(stairCarrier.anchorCell()));
    }

    public int levelZ() {
        return localConnection == null ? 0 : localConnection.levelZ();
    }

    public boolean occupiesLevel(int levelZ) {
        return localConnection != null && localConnection.occupiedLevels().contains(levelZ);
    }

    public GridPoint focusPosition(DungeonLayout layout) {
        return localConnection == null ? null : localConnection.focusPosition(layout);
    }
}
