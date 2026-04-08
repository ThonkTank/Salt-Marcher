package features.world.dungeon.runtime.input;

public record ResolveNavigationInput(
        Long preferredMapId,
        features.world.dungeon.geometry.GridPoint preferredCell,
        int preferredLevelZ,
        String preferredHeading
) {
    public ResolveNavigationInput {
        preferredHeading = preferredHeading == null ? "" : preferredHeading.trim();
    }

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
