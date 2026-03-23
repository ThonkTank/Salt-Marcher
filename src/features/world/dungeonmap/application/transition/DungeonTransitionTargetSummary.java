package features.world.dungeonmap.application.transition;

public record DungeonTransitionTargetSummary(
        long transitionId,
        long mapId,
        String label
) {
    public DungeonTransitionTargetSummary {
        label = label == null || label.isBlank() ? "Übergang " + transitionId : label.trim();
    }
}
