package features.world.dungeonmap.model.structures.transition;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.TargetKey;

public record DungeonTransition(
        Long transitionId,
        long mapId,
        String description,
        CubePoint anchor,
        DungeonTransitionDestination destination,
        Long linkedTransitionId
) {

    private static final String TARGET_KEY_PREFIX = "transition:";

    public DungeonTransition {
        description = description == null ? "" : description.trim();
    }

    public String label() {
        return "Übergang " + (transitionId == null ? "neu" : transitionId);
    }

    public String targetKey() {
        return targetKey(transitionId);
    }

    public static String targetKey(Long transitionId) {
        return TargetKey.of(TARGET_KEY_PREFIX, transitionId).value();
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long transitionIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
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
                targetKey(),
                label(),
                LegacyGridPoint2x.fromTileCenter(anchor.projectedCell()));
    }

    public int levelZ() {
        return anchor == null ? 0 : anchor.z();
    }
}
