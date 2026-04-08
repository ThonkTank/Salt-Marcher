package features.world.dungeon.runtime.input;

public record NavigateToCellInput(
        long mapId,
        NavigationInput currentNavigation,
        features.world.dungeon.geometry.GridPoint cell,
        int levelZ
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

        public static NavigationInput empty() {
            return new NavigationInput(null, null, 0, "");
        }

        public static NavigationInput navigation(
                Long mapId,
                features.world.dungeon.geometry.GridPoint cell,
                int levelZ,
                String heading
        ) {
            return new NavigationInput(mapId, cell, levelZ, heading);
        }
    }
}
