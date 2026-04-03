package features.world.dungeonmap.model.structures.transition;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;

public record DungeonTransition(
        Long transitionId,
        long mapId,
        String description,
        CubePoint anchor,
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
        return anchor != null;
    }

    public boolean isLinked() {
        return linkedTransitionId != null && linkedTransitionId > 0;
    }

    public InteractiveLabelHandle labelHandle() {
        if (anchor == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.TransitionRef(transitionId),
                label(),
                GridPoint2x.cell(anchor.projectedCell()));
    }

    public int levelZ() {
        return anchor == null ? 0 : anchor.z();
    }
}
