package features.world.dungeon.transition.input;

public record LoadDungeonTargetsInput(
        long mapId
) {
    public record TargetInput(
            Long transitionId,
            long mapId,
            String label,
            String description,
            String placementKind,
            Integer anchorLevelZ
    ) {
        public TargetInput {
            label = label == null || label.isBlank() ? "Übergang" : label.trim();
            description = description == null ? "" : description.trim();
            placementKind = placementKind == null ? "" : placementKind.trim();
        }
    }
}
