package features.world.dungeon.transition.input;

public record LoadOverworldTargetsInput() {
    public record TargetInput(
            long mapId,
            long tileId,
            String label
    ) {
        public TargetInput {
            label = label == null || label.isBlank() ? "Overworld-Ziel" : label.trim();
        }
    }
}
