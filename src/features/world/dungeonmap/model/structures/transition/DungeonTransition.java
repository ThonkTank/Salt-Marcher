package features.world.dungeonmap.model.structures.transition;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.TransitionConnection;

import java.util.List;
import java.util.Set;

public record DungeonTransition(
        Long transitionId,
        long mapId,
        String description,
        DungeonTransitionPlacement placement,
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
        return placement != null;
    }

    public boolean isLinked() {
        return linkedTransitionId != null && linkedTransitionId > 0;
    }

    public InteractiveLabelHandle labelHandle() {
        if (placement == null) {
            return null;
        }
        return placement.labelHandle(transitionId, label());
    }

    public int levelZ() {
        return placement == null ? 0 : placement.primaryLevelZ();
    }

    public boolean occupiesLevel(int levelZ) {
        return placement != null && placement.occupiedLevels().contains(levelZ);
    }

    public CubePoint entryPoint(DungeonLayout layout) {
        return placement == null ? null : placement.entryPoint(layout);
    }

    public CardinalDirection entryHeading(DungeonLayout layout) {
        return placement == null ? null : placement.entryHeading(layout);
    }

    public Connection asConnection() {
        if (!(placement instanceof DungeonTransitionPlacement.DoorPlacement doorPlacement) || transitionId == null) {
            return null;
        }
        return new TransitionConnection(
                transitionId,
                mapId,
                Door.fromSegments(List.of(doorPlacement.boundarySegment2x()), Door.DoorState.OPEN),
                List.of(doorPlacement.sourceEndpoint(), ConnectionEndpoint.transition(transitionId)),
                doorPlacement.levelZ());
    }

    public DungeonTransitionPlacement.DoorPlacement doorPlacement() {
        return placement instanceof DungeonTransitionPlacement.DoorPlacement doorPlacement ? doorPlacement : null;
    }

    public DungeonTransitionPlacement.StairPlacement stairPlacement() {
        return placement instanceof DungeonTransitionPlacement.StairPlacement stairPlacement ? stairPlacement : null;
    }

    public CubePoint representativeCell() {
        if (placement instanceof DungeonTransitionPlacement.StairPlacement stairPlacement) {
            return CubePoint.at(stairPlacement.anchorCell(), stairPlacement.anchorLevelZ());
        }
        return null;
    }

    public CubePoint focusPosition(DungeonLayout layout) {
        CubePoint representative = representativeCell();
        return representative != null ? representative : entryPoint(layout);
    }

    public Set<CubePoint> occupiedPositions(DungeonLayout layout) {
        if (placement == null) {
            return Set.of();
        }
        Set<CubePoint> occupied = placement.occupiedPositions();
        if (!occupied.isEmpty()) {
            return occupied;
        }
        CubePoint focus = focusPosition(layout);
        return focus == null ? Set.of() : Set.of(focus);
    }
}
