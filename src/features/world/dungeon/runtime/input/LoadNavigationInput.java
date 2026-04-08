package features.world.dungeon.runtime.input;

public record LoadNavigationInput(
        long mapId
) {
    public record NavigationInput(
            Long mapId,
            features.world.dungeon.geometry.GridPoint cell,
            int levelZ,
            String heading
    ) {
        public NavigationInput {
            heading = heading == null ? "" : heading.trim();
        }
    }
}
