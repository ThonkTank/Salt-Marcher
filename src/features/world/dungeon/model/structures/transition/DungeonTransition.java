package features.world.dungeon.model.structures.transition;

import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.model.interaction.InteractiveLabelHandle;
import features.world.dungeon.model.structures.connection.DungeonConnection;
import features.world.dungeon.model.structures.connection.StairConnectionCarrier;
import features.world.dungeon.stair.model.StairPlacementSpec;

public record DungeonTransition(
        Long transitionId,
        long mapId,
        String description,
        DungeonConnection localConnection,
        DungeonTransitionDestination destination,
        Long linkedTransitionId,
        StairPlacementSpec stairPlacementSpec
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
        return new DungeonTransition(transitionId, mapId, description, localConnection, destination, linkedTransitionId, stairPlacementSpec);
    }

    public InteractiveLabelHandle labelHandle(DungeonMap layout) {
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
                stairCarrier.anchorCell());
    }

    public int levelZ() {
        return localConnection == null ? 0 : localConnection.levelZ();
    }

    public boolean occupiesLevel(int levelZ) {
        return localConnection != null && localConnection.occupiedLevels().contains(levelZ);
    }

    public GridPoint focusPosition(DungeonMap layout) {
        return localConnection == null ? null : localConnection.focusPosition(layout);
    }
}
