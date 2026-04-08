package features.world.dungeon.transition.input;

public record LoadDungeonTargetsInput(
        long mapId
) {
    public record TargetInput(
            Long transitionId,
            long mapId,
            String label,
            String description,
            int levelZ,
            Long doorId,
            Integer anchorCellX,
            Integer anchorCellY,
            Integer anchorCellZ,
            Integer anchorLevelZ
    ) {
        public TargetInput {
            label = label == null || label.isBlank() ? "Übergang" : label.trim();
            description = description == null ? "" : description.trim();
        }

        public boolean isDoorPlacement() {
            return doorId != null && doorId > 0;
        }

        public boolean isStairPlacement() {
            return anchorCellX != null
                    && anchorCellY != null
                    && anchorCellZ != null
                    && anchorLevelZ != null;
        }
    }
}
