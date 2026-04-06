package features.world.dungeonmap.model.structures.transition;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
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

    public InteractiveLabelHandle labelHandle() {
        if (localConnection == null || transitionId == null) {
            return null;
        }
        DoorConnectionCarrier doorCarrier = localConnection.doorCarrier();
        if (doorCarrier != null) {
            GridSegment2x anchorSegment2x = localConnection.anchorSegment2x();
            if (anchorSegment2x == null) {
                return null;
            }
            return new InteractiveLabelHandle(
                    new DungeonSelectionRef.TransitionRef(transitionId),
                    label(),
                    anchorSegment2x.midpoint());
        }
        StairConnectionCarrier stairCarrier = localConnection.stairCarrier();
        if (stairCarrier == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.TransitionRef(transitionId),
                label(),
                GridPoint2x.cell(stairCarrier.anchorCell()));
    }

    public int levelZ() {
        return localConnection == null ? 0 : localConnection.levelZ();
    }

    public boolean occupiesLevel(int levelZ) {
        return localConnection != null && localConnection.occupiedLevels().contains(levelZ);
    }

    public CubePoint focusPosition(DungeonLayout layout) {
        return localConnection == null ? null : localConnection.focusPosition(layout);
    }
}
