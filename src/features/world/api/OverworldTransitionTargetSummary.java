package features.world.api;

public record OverworldTransitionTargetSummary(
        long mapId,
        long tileId,
        String label
) {
    public OverworldTransitionTargetSummary {
        label = label == null || label.isBlank() ? "Overworld-Ziel" : label.trim();
    }
}
